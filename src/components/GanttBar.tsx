import {
  EDGE_THRESHOLD,
  MILESTONE_HALF_DIAGONAL,
  MIN_BAR_WIDTH,
  MIN_LABEL_INSIDE_WIDTH,
  MIN_RESIZABLE_WIDTH,
  NODE_HEIGHT,
} from "constants/gantt";
import { useGanttBarDrag, DragMode } from "hooks/useGanttBarDrag";
import { useGanttProgressDrag } from "hooks/useGanttProgressDrag";
import { useRef, useState, useCallback, useMemo } from "react";
import { useGanttStore } from "stores/context";
import {
  GanttInteractionConfig,
  isMilestoneTask,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
import { formatTaskAriaLabel } from "utils/a11y";
import { resolveFormatters } from "utils/i18n";

interface GanttBarProps {
  currentTask: TaskTransformed;
  onTasksChange?: (updatedTasks: Task[]) => void;
  interaction?: GanttInteractionConfig;
  /**
   * Roving tabindex of the treegrid (default -1)
   *
   * Exactly one cell in the chart carries 0, so Tab enters and leaves the whole
   * grid once and the arrow keys move within it.
   */
  tabIndex?: number;
  /** `row:column` coordinate the chart's focus manager looks the cell up by */
  cellCoord?: string;
}

export default function GanttBar({
  currentTask,
  onTasksChange,
  interaction,
  tabIndex = -1,
  cellCoord,
}: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, dragMode } = useGanttBarDrag(
    currentTask,
    onTasksChange,
    interaction
  );
  const { canMove, canResize, canChangeProgress } = resolveTaskInteraction(
    currentTask,
    interaction
  );
  // Only the pointer position is tracked here - the cursor itself is derived below,
  // so a permission that changes after mount cannot leave a stale affordance behind
  const [onResizeEdge, setOnResizeEdge] = useState(false);

  // Read the drag offset
  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.currentTask?.id === currentTask.id);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const localeOptions = useGanttStore((store) => store.localeOptions);


  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  // Final position and size
  // Guarantee a minimum width so short tasks stay grabbable; move the label outside when narrow
  const finalLeft = currentTask.barLeft + offsetX;
  const finalWidth = Math.max(
    currentTask.barWidth + offsetWidth,
    MIN_BAR_WIDTH
  );
  const labelOutside = finalWidth < MIN_LABEL_INSIDE_WIDTH;

  const isMilestone = isMilestoneTask(currentTask);

  // Progress (milestones have none)
  const { onProgressPointerDown, progress, isDraggingProgress } =
    useGanttProgressDrag(currentTask, barRef, onTasksChange);
  const showProgress = !isMilestone && progress !== null;

  // Track whether the pointer is over a resize edge. Milestones, summaries and
  // narrow bars have none, but that is decided by canResize when the cursor is
  // derived - this only reports where the pointer is.
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current;
      if (!bar) return;

      const rect = bar.getBoundingClientRect();
      if (rect.width < MIN_RESIZABLE_WIDTH) {
        setOnResizeEdge(false);
        return;
      }

      const relativeX = e.clientX - rect.left;

      setOnResizeEdge(
        relativeX <= EDGE_THRESHOLD || relativeX >= rect.width - EDGE_THRESHOLD
      );
    },
    []
  );

  // A gesture that is not allowed shows no affordance at all
  const restCursor = canMove ? "grab" : "default";
  const barCursor = isDragging
    ? canMove || canResize
      ? "grabbing"
      : restCursor
    : onResizeEdge && canResize
      ? "ew-resize"
      : restCursor;

  // Build the tooltip text (shown differently per mode)
  const { tooltip } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );
  // "Design phase, Mar 3 to Mar 14, 40% complete" - the dates are on the bar itself
  // because a screen reader user never sees the date header above it
  const ariaLabel = formatTaskAriaLabel(
    currentTask,
    tooltip,
    showProgress ? progress : null
  );

  const getTooltipText = (mode: DragMode | null) => {
    if (!liveOffset) return "";

    const startText = tooltip(liveOffset.offsetStartDate);
    const endText = tooltip(liveOffset.offsetEndDate);

    if (isMilestone) return startText;

    switch (mode) {
      case "left":
        return `Start: ${startText}`;
      case "right":
        return `End: ${endText}`;
      case "bar":
      default:
        return `${startText} → ${endText}`;
    }
  };

  // Milestone: a diamond at the single startDate point, with a label to its right
  if (isMilestone) {
    return (
      <div
        ref={barRef}
        id={`task-${currentTask.id}`}
        className={`gantt-milestone${isDragging ? " dragging" : ""}`}
        onPointerDown={onPointerDown}
        style={{
          transform: `translateX(${finalLeft - MILESTONE_HALF_DIAGONAL}px)`,
          height: NODE_HEIGHT / 2,
          cursor: barCursor,
        }}
        role="gridcell"
        tabIndex={tabIndex}
        data-gantt-cell={cellCoord}
        aria-label={ariaLabel}
      >
        <div className="gantt-milestone-diamond" />
        <span className="gantt-milestone-name">{currentTask.name}</span>

        {/* Tooltip while dragging */}
        {isDragging && liveOffset && (
          <div className="gantt-bar-tooltip" role="status" aria-live="polite">
            {getTooltipText(dragMode)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      id={`task-${currentTask.id}`}
      className={`gantt-task-bar${isDragging ? " dragging" : ""}${
        labelOutside ? " compact" : ""
      }${currentTask.isSummary ? " summary" : ""}${
        canResize ? "" : " no-resize"
      }`}
      onPointerDown={onPointerDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setOnResizeEdge(false)}
      style={{
        transform: `translateX(${finalLeft}px)`,
        width: finalWidth,
        height: NODE_HEIGHT / 2,
        cursor: barCursor,
      }}
      role="gridcell"
      tabIndex={tabIndex}
      data-gantt-cell={cellCoord}
      aria-label={ariaLabel}
    >
      {/* Progress fill + handle */}
      {showProgress && (
        <>
          <div
            className="gantt-progress-fill"
            style={{ width: `${progress}%` }}
          />
          {/* The fill stays as a readout; only the draggable handle is gated.
              canChangeProgress is already false for a summary's rolled-up progress. */}
          {canChangeProgress && (
            <div
              className={`gantt-progress-handle${
                isDraggingProgress ? " dragging" : ""
              }`}
              style={{ left: `${progress}%` }}
              onPointerDown={onProgressPointerDown}
              role="slider"
              tabIndex={-1}
              aria-label={`${currentTask.name} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            />
          )}
        </>
      )}

      <span
        className={`gantt-task-name${labelOutside ? " outside" : ""}`}
      >
        {currentTask.name}
      </span>

      {/* Tooltip while dragging */}
      {isDragging && liveOffset && (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {getTooltipText(dragMode)}
        </div>
      )}

      {/* Tooltip while dragging progress */}
      {isDraggingProgress && (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {progress}%
        </div>
      )}
    </div>
  );
}
