import { NODE_HEIGHT } from "shared/constants";
import { GanttDependencyChange } from "dependencies/hooks/useGanttLinkDrag";
import type { GanttVirtualization } from "timeline/hooks/useGanttVirtualization";
import { useCallback, useEffect, useId, useMemo } from "react";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import {
  GanttInteractionConfig,
  RenderedDependency,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import {
  anchorPoint,
  ArrowViewport,
  buildDependencies,
  buildTaskIndex,
  getSmartGanttPath,
  isArrowVisible,
} from "dependencies/utils/arrowPath";
import {
  LINK_REJECTION_LABEL,
  linkTypeFromAnchors,
  removeDependency,
} from "dependencies/utils/link";

interface Props {
  transformedTasks: TaskTransformed[];
  // Row count of the chart - a lane row can carry several tasks, so it is not the task count
  rowCount: number;
  // The chart's window - arrows cull against the same numbers as the bars
  virtual: GanttVirtualization;
  interaction?: GanttInteractionConfig;
  onTasksChange?: (updatedTasks: Task[]) => void;
  // Returning false keeps the dependency
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
}

// Radius of the delete affordance on the selected arrow (px)
const DELETE_BUTTON_RADIUS = 8;

// Keeps a drag label off the clipped top edge of the SVG (px)
const LABEL_MIN_Y = 14;
// Closer than this to the end of the timeline, a drag label is drawn to the left (px)
const LABEL_SAFE_MARGIN = 220;

// Keyboard deletion belongs to the chart only when the host is not typing
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  return (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  );
}

export default function GanttDependencyArrows({
  transformedTasks,
  rowCount,
  virtual,
  interaction,
  onTasksChange,
  onDependencyDelete,
}: Props) {
  const storeApi = useGanttStoreApi();
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const linkDraft = useGanttStore((store) => store.linkDraft);
  const totalWidth = useGanttStore((store) => store.getTotalWidth());
  const selected = useGanttStore((store) => store.selectedDependency);
  const selectedTaskId = useGanttStore((store) => store.selectedTaskId);
  const hoveredTaskId = useGanttStore((store) => store.hoveredTaskId);

  const taskById = useMemo(
    () => buildTaskIndex(transformedTasks),
    [transformedTasks]
  );

  // Arrows outside the viewport are never built; the chart's own bounds are used so no arrow
  // is culled a frame before the bar it points at
  const viewport: ArrowViewport = {
    topPx: virtual.rowStartPx,
    bottomPx: virtual.rowEndPx,
    isBarVisible: virtual.isBarVisible,
  };

  const dependencies = buildDependencies(taskById, liveOffsets).filter((dep) =>
    isArrowVisible(dep, viewport)
  );

  const isSelected = (dep: RenderedDependency) =>
    selected?.sourceId === dep.sourceId && selected?.targetId === dep.targetId;

  // Either end counts, so one bar lights both what feeds it and what it feeds. Hover and
  // selection are OR'd, not ranked: comparing one chain against another must blank neither.
  const relatedArrow = (dep: RenderedDependency) =>
    (hoveredTaskId !== null &&
      (dep.sourceId === hoveredTaskId || dep.targetId === hoveredTaskId)) ||
    (selectedTaskId !== null &&
      (dep.sourceId === selectedTaskId || dep.targetId === selectedTaskId));

  const deleteSelected = useCallback(() => {
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

    // The host gets the last word before anything changes
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
  }, [storeApi, interaction, onDependencyDelete, onTasksChange]);

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        storeApi.getState().setSelectedDependency(null);
      }
    };

    // The arrow's own handler stops the event, so anything reaching the document deselects
    const handlePointerDown = () => {
      storeApi.getState().setSelectedDependency(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [selected, deleteSelected, storeApi]);

  // Both ends come from the tasks, not the draft, so neither can drift from its bar. Once
  // the target is settled the line switches to the elbow `getSmartGanttPath` will commit.
  const preview = useMemo(() => {
    if (!linkDraft) return null;

    const fromTask = taskById.get(linkDraft.fromTaskId);
    if (!fromTask) return null;

    const from = anchorPoint(
      fromTask,
      linkDraft.fromAnchor,
      liveOffsets[fromTask.id]
    );
    const targetTask = linkDraft.hoverTaskId
      ? taskById.get(linkDraft.hoverTaskId)
      : undefined;
    const type =
      linkDraft.hoverAnchor &&
      linkTypeFromAnchors(linkDraft.fromAnchor, linkDraft.hoverAnchor);
    const armed =
      !linkDraft.rejection &&
      targetTask !== undefined &&
      linkDraft.hoverAnchor !== null;

    const to =
      armed && targetTask && linkDraft.hoverAnchor
        ? anchorPoint(
            targetTask,
            linkDraft.hoverAnchor,
            liveOffsets[targetTask.id]
          )
        : { x: linkDraft.toX, y: linkDraft.toY };

    // The SVG clips at its own box, so a label near its top or right edge would be cut off
    const flip = to.x > totalWidth - LABEL_SAFE_MARGIN;
    return {
      from,
      d:
        armed && type
          ? getSmartGanttPath(type, from.x, from.y, to.x, to.y)
          : `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      armed,
      type,
      rejection: linkDraft.rejection,
      label: {
        x: flip ? to.x - 12 : to.x + 12,
        y: Math.max(LABEL_MIN_Y, to.y - 8),
        anchor: flip ? ("end" as const) : ("start" as const),
      },
    };
  }, [linkDraft, taskById, liveOffsets, totalWidth]);

  // Marker ids are document-global, so several charts on a page would mix them up. useId
  // values contain characters a url(#...) reference rejects, hence the strip.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowheadId = `gantt-arrowhead-${instanceId}`;

  return (
    <svg
      className={`gantt-dependency-arrows${linkDraft ? " linking" : ""}`}
      style={{
        height: `${rowCount * NODE_HEIGHT}px`,
      }}
    >
      <defs>
        <marker
          id={arrowheadId}
          markerWidth="5"
          markerHeight="5"
          refX="4.5"
          refY="2.5"
          orient="auto"
        >
          <polygon
            className="gantt-dependency-arrow-head"
            points="0 0, 5 2.5, 0 5"
          />
        </marker>
      </defs>

      {dependencies.map((dep, index) => {
        const path = getSmartGanttPath(
          dep.type,
          dep.fromX,
          dep.fromY,
          dep.toX,
          dep.toY
        );
        const selectedArrow = isSelected(dep);
        // An arrow nobody may remove is not clickable either - readOnly leaves the chart inert
        const source = taskById.get(dep.sourceId);
        const deletable =
          source !== undefined &&
          resolveTaskInteraction(source, interaction).canDeleteLink;

        return (
          <g key={`arrow-${index}`}>
            {/* A 1.5px line is not a pointer target - this invisible one carries the clicks */}
            {deletable && (
              <path
                className="gantt-dependency-hit"
                d={path}
                fill="none"
                onPointerDown={(event) => {
                  // Keep the document handler from deselecting this same click
                  event.stopPropagation();
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
              d={path}
              markerEnd={`url(#${arrowheadId})`}
              fill="none"
            />
            {selectedArrow && (
              <g
                className="gantt-dependency-delete"
                transform={`translate(${(dep.fromX + dep.toX) / 2} ${
                  (dep.fromY + dep.toY) / 2
                })`}
                role="button"
                aria-label={`Delete ${dep.type} dependency`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  deleteSelected();
                }}
              >
                <circle r={DELETE_BUTTON_RADIUS} />
                <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" />
              </g>
            )}
          </g>
        );
      })}

      {preview && (
        <g className="gantt-link-preview">
          <path
            className={`gantt-link-preview-line${
              preview.rejection ? " invalid" : ""
            }${preview.armed ? " armed" : ""}`}
            d={preview.d}
            fill="none"
            markerEnd={preview.rejection ? undefined : `url(#${arrowheadId})`}
          />
          <circle
            className="gantt-link-preview-origin"
            cx={preview.from.x}
            cy={preview.from.y}
            r="3"
          />
          {/* The ends decide the type, which the shape of a line cannot say */}
          {preview.armed && preview.type && (
            <text
              className="gantt-link-preview-type"
              x={preview.label.x}
              y={preview.label.y}
              textAnchor={preview.label.anchor}
            >
              {preview.type}
            </text>
          )}
          {preview.rejection && (
            <text
              className="gantt-link-preview-reason"
              x={preview.label.x}
              y={preview.label.y}
              textAnchor={preview.label.anchor}
            >
              {LINK_REJECTION_LABEL[preview.rejection]}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
