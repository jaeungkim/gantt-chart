import { GanttDependencyChange } from "features/dependencies/types";
import type { GanttVirtualization } from "features/timeline/types";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HEADER_HEIGHT } from "shared/constants";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import {
  GanttInteractionConfig,
  RenderedDependency,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import { GanttGeometry } from "shared/types";
import {
  buildDependencies,
  isArrowVisible,
  linkPreview,
} from "features/dependencies/utils/arrowPath";
import {
  LINK_REJECTION_LABEL,
  LINK_TYPE_TITLE,
  linkTypeFromAnchors,
  removeDependency,
} from "features/dependencies/utils/link";

interface Props {
  transformedTasks: TaskTransformed[];
  virtual: GanttVirtualization;
  interaction?: GanttInteractionConfig;
  onTasksChange?: (updatedTasks: Task[]) => void;
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
  geometry: GanttGeometry;
}

const MENU_FLIP_Y = 48;

const LABEL_OFFSET = 20;
const LABEL_HEIGHT = 24;
const LABEL_SAFE_MARGIN = 220;

export default function GanttDependencyArrows({
  transformedTasks,
  virtual,
  interaction,
  onTasksChange,
  onDependencyDelete,
  geometry,
}: Props) {
  const storeApi = useGanttStoreApi();
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const linking = useGanttStore((store) => store.linkDraft !== null);
  const selected = useGanttStore((store) => store.selectedDependency);
  const selectedTaskId = useGanttStore((store) => store.selectedTaskId);
  const hoveredTaskId = useGanttStore((store) => store.hoveredTaskId);
  const [menuAt, setMenuAt] = useState<{
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const arrowsRef = useRef<SVGSVGElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const taskById = useMemo(
    () => new Map(transformedTasks.map((task) => [task.id, task])),
    [transformedTasks]
  );

  const allDependencies = useMemo(
    () => buildDependencies(taskById, liveOffsets, geometry),
    [taskById, liveOffsets, geometry]
  );

  const isSelected = (dep: RenderedDependency) =>
    selected?.sourceId === dep.sourceId && selected?.targetId === dep.targetId;

  const selectedDependency = allDependencies.find(isSelected);

  const dependencies = [
    ...allDependencies.filter(
      (dep) => !isSelected(dep) && isArrowVisible(dep, virtual)
    ),
    ...allDependencies.filter(isSelected),
  ];

  const relatedArrow = (dep: RenderedDependency) =>
    [hoveredTaskId, selectedTaskId].some(
      (id) => id !== null && (dep.sourceId === id || dep.targetId === id)
    );

  const deleteSelected = () => {
    const { rawTasks, selectedDependency, setRawTasks, setSelectedDependency } =
      storeApi.getState();
    if (!selectedDependency) return;

    const { sourceId, targetId } = selectedDependency;
    const successor = rawTasks.find((task) => task.id === sourceId);
    const dependency = successor?.dependencies?.find(
      (dep) => dep.targetId === targetId
    );
    if (!successor || !dependency) return;

    if (!resolveTaskInteraction(successor, interaction).canDeleteLink) return;

    const change: GanttDependencyChange = {
      predecessorId: targetId,
      successorId: sourceId,
      type: dependency.type,
    };
    if (onDependencyDelete?.(change) === false) return;

    setSelectedDependency(null);
    const updatedTasks = removeDependency(rawTasks, targetId, sourceId);
    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);
  };

  useEffect(() => {
    if (!selected) return;

    const clearSelection = (event: Event) => {
      const path = event.composedPath();
      const own = [arrowsRef.current, menuRef.current];
      if (own.some((node) => node && path.includes(node))) return;
      storeApi.getState().setSelectedDependency(null);
    };

    const root = arrowsRef.current?.getRootNode() ?? document;
    const host = root instanceof ShadowRoot ? root.host : null;
    const clearOutside = (event: Event) => {
      if (host && !event.composedPath().includes(host)) clearSelection(event);
    };

    root.addEventListener("pointerdown", clearSelection, true);
    if (host) document.addEventListener("pointerdown", clearOutside, true);
    return () => {
      root.removeEventListener("pointerdown", clearSelection, true);
      document.removeEventListener("pointerdown", clearOutside, true);
    };
  }, [selected, storeApi]);

  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowheadId = `gantt-arrowhead-${instanceId}`;

  return (
    <>
      <svg
        ref={arrowsRef}
        className={`gantt-dependency-arrows${linking ? " linking" : ""}`}
        style={{
          height: `${virtual.totalHeight}px`,
        }}
      >
        <defs>
          {["", " selected"].map((variant) => (
            <marker
              key={variant}
              id={`${arrowheadId}${variant ? "-selected" : ""}`}
              viewBox="0 0 5 5"
              markerUnits="userSpaceOnUse"
              markerWidth="7.5"
              markerHeight="7.5"
              refX="4.5"
              refY="2.5"
              orient="auto"
            >
              <polygon
                className={`gantt-dependency-arrow-head${variant}`}
                points="0 0, 5 2.5, 0 5"
              />
            </marker>
          ))}
        </defs>

        {dependencies.map((dep, index) => {
          const selectedArrow = isSelected(dep);
          const source = taskById.get(dep.sourceId);
          const deletable =
            source !== undefined &&
            resolveTaskInteraction(source, interaction).canDeleteLink;

          return (
            <g key={`${dep.sourceId}-${dep.targetId}-${index}`}>
              {deletable && (
                <path
                  className="gantt-dependency-hit"
                  d={dep.d}
                  fill="none"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const svg = event.currentTarget.ownerSVGElement;
                    if (!svg) return;

                    const rect = svg.getBoundingClientRect();
                    const viewTop =
                      svg.closest(".gantt-scroll-container")?.getBoundingClientRect()
                        .top ?? rect.top;
                    setMenuAt({
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                      below: event.clientY - viewTop < HEADER_HEIGHT + MENU_FLIP_Y,
                    });
                    storeApi.getState().setSelectedDependency({
                      sourceId: dep.sourceId,
                      targetId: dep.targetId,
                    });
                  }}
                />
              )}
              <path
                className={`gantt-dependency-arrow${
                  selectedArrow ? " selected" : ""
                }${relatedArrow(dep) ? " related" : ""}`}
                d={dep.d}
                markerEnd={`url(#${arrowheadId}${
                  selectedArrow ? "-selected" : ""
                })`}
                fill="none"
              />
            </g>
          );
        })}

      </svg>

      <LinkPreview
        arrowheadId={arrowheadId}
        height={virtual.totalHeight}
        totalWidth={virtual.totalWidth}
        taskById={taskById}
        geometry={geometry}
      />

      {selectedDependency && menuAt && (
        <div
          ref={menuRef}
          className={`gantt-link-menu${menuAt.below ? " below" : ""}`}
          style={{ left: menuAt.x, top: menuAt.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="gantt-link-menu-delete"
            title="Delete link"
            aria-label="Delete link"
            onClick={deleteSelected}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

function LinkPreview({
  arrowheadId,
  height,
  totalWidth,
  taskById,
  geometry,
}: {
  arrowheadId: string;
  height: number;
  totalWidth: number;
  taskById: Map<string, TaskTransformed>;
  geometry: GanttGeometry;
}) {
  const draft = useGanttStore((store) => store.linkDraft);
  if (!draft) return null;

  const armed = draft.hoverAnchor !== null && !draft.rejection;
  const type =
    draft.hoverAnchor && linkTypeFromAnchors(draft.fromAnchor, draft.hoverAnchor);
  const flip = draft.toX > totalWidth - LABEL_SAFE_MARGIN;
  const preview = linkPreview(draft, taskById, geometry);

  return (
    <>
      <svg className="gantt-link-preview" style={{ height: `${height}px` }}>
        <path
          className={`gantt-link-preview-line${
            draft.rejection ? " invalid" : ""
          }${armed ? " armed" : ""}`}
          d={preview.d}
          fill="none"
          markerEnd={
            draft.rejection ? undefined : `url(#${arrowheadId}-selected)`
          }
        />
        <circle
          className="gantt-link-preview-origin"
          cx={preview.fromX}
          cy={preview.fromY}
          r="3"
        />
      </svg>
      {type && (
        <div
          className={`gantt-link-preview-label${
            draft.rejection ? " invalid" : ""
          }${flip ? " flip" : ""}`}
          style={{
            left: draft.toX + (flip ? -LABEL_OFFSET : LABEL_OFFSET),
            top: Math.min(draft.toY + LABEL_OFFSET, height - LABEL_HEIGHT),
          }}
        >
          {draft.rejection ? (
            LINK_REJECTION_LABEL[draft.rejection]
          ) : (
            <>
              <b>{type}</b>
              {LINK_TYPE_TITLE[type]}
            </>
          )}
        </div>
      )}
    </>
  );
}
