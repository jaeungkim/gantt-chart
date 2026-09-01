import { NODE_HEIGHT } from "constants/gantt";
import { GanttDependencyChange } from "hooks/useGanttLinkDrag";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "stores/context";
import {
  GanttInteractionConfig,
  RenderedDependency,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
import {
  ArrowViewport,
  buildDependencies,
  buildTaskIndex,
  getSmartGanttPath,
  isArrowVisible,
} from "utils/arrowPath";
import { LINK_REJECTION_LABEL, removeDependency } from "utils/dependency";

interface Props {
  transformedTasks: TaskTransformed[];
  /** Link keys on the critical path (from computeCriticalPath) - undefined when it is off */
  criticalLinkIds?: Set<string>;
  interaction?: GanttInteractionConfig;
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Returning false keeps the dependency */
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
}

/** Radius of the delete affordance on the selected arrow (px) */
const DELETE_BUTTON_RADIUS = 8;

/** Keyboard deletion belongs to the chart only when the host is not typing */
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
  criticalLinkIds,
  interaction,
  onTasksChange,
  onDependencyDelete,
}: Props) {
  const storeApi = useGanttStoreApi();
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);
  const linkDraft = useGanttStore((store) => store.linkDraft);
  const selected = useGanttStore((store) => store.selectedDependency);

  // The scroll container is an ancestor of the SVG, so it is looked up on mount.
  // Using the same virtualization window as the bar culling keeps arrows from being
  // culled ahead of the bars.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const attachSvg = useCallback((svg: SVGSVGElement | null) => {
    scrollRef.current =
      svg?.closest<HTMLDivElement>(".gantt-scroll-container") ?? null;
  }, []);

  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    transformedTasks,
    bottomRowCells,
    scrollRef,
  });

  // The task index is rebuilt only when the data changes (not on every drag frame)
  const taskById = useMemo(
    () => buildTaskIndex(transformedTasks),
    [transformedTasks]
  );

  // Arrows outside the viewport are never built - the rows are already virtualized, so on
  // large data sets the arrows were the real limit
  const visibleRows = rowVirtualizer.getVirtualItems();
  const lastRow = visibleRows[visibleRows.length - 1];
  const viewport: ArrowViewport = {
    topPx: visibleRows[0]?.start ?? 0,
    bottomPx: lastRow ? lastRow.start + lastRow.size : 0,
    isBarVisible,
  };

  const dependencies = buildDependencies(
    taskById,
    liveOffsets,
    criticalLinkIds
  ).filter((dep) => isArrowVisible(dep, viewport));

  const isSelected = (dep: RenderedDependency) =>
    selected?.sourceId === dep.sourceId && selected?.targetId === dep.targetId;

  const deleteSelected = useCallback(() => {
    const { rawTasks, selectedDependency, commitTasks, setSelectedDependency } =
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
    // commitTasks, not setRawTasks: removing an arrow is a gesture, so it is one undo step
    commitTasks(updatedTasks);
    onTasksChange?.(updatedTasks);
  }, [storeApi, interaction, onDependencyDelete, onTasksChange]);

  // Delete/Escape and clicking elsewhere only matter while an arrow is selected
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

  // Marker ids are document-global, so each instance needs its own or several charts on a
  // page would mix them up
  // useId values contain characters that are invalid in a url(#...) reference, so only
  // alphanumerics are kept
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowheadId = `gantt-arrowhead-${instanceId}`;
  const criticalArrowheadId = `${arrowheadId}-critical`;

  return (
    <svg
      ref={attachSvg}
      className={`gantt-dependency-arrows${linkDraft ? " linking" : ""}`}
      style={{
        height: `${transformedTasks.length * NODE_HEIGHT}px`,
      }}
    >
      <defs>
        {[arrowheadId, criticalArrowheadId].map((id) => (
          <marker
            key={id}
            id={id}
            markerWidth="5"
            markerHeight="5"
            refX="4.5"
            refY="2.5"
            orient="auto"
          >
            <polygon
              className={`gantt-dependency-arrow-head${
                id === criticalArrowheadId ? " critical" : ""
              }`}
              points="0 0, 5 2.5, 0 5"
            />
          </marker>
        ))}
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
              }${dep.critical ? " critical" : ""}`}
              d={path}
              markerEnd={`url(#${
                dep.critical ? criticalArrowheadId : arrowheadId
              })`}
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

      {/* Rubber band - follows the pointer while a link is being drawn */}
      {linkDraft && (
        <g className="gantt-link-preview">
          <path
            className={`gantt-link-preview-line${
              linkDraft.rejection ? " invalid" : ""
            }`}
            d={`M ${linkDraft.fromX} ${linkDraft.fromY} L ${linkDraft.toX} ${linkDraft.toY}`}
            fill="none"
            markerEnd={
              linkDraft.rejection ? undefined : `url(#${arrowheadId})`
            }
          />
          <circle
            className="gantt-link-preview-origin"
            cx={linkDraft.fromX}
            cy={linkDraft.fromY}
            r="3"
          />
          {linkDraft.rejection && (
            <text
              className="gantt-link-preview-reason"
              x={linkDraft.toX + 12}
              y={linkDraft.toY - 8}
            >
              {LINK_REJECTION_LABEL[linkDraft.rejection]}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
