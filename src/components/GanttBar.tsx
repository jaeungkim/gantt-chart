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
import { CSSProperties, useRef, useState, useCallback, useMemo } from "react";
import { useGanttStore } from "stores/context";
import { GanttBarOptions, GanttTooltipReason } from "types/gantt";
import {
  GanttInteractionConfig,
  isMilestoneTask,
  resolveTaskColors,
  resolveTaskInteraction,
  TaskTransformed,
} from "types/task";
import dayjs from "utils/dayjs";
import { resolveFormatters } from "utils/i18n";

interface GanttBarProps {
  currentTask: TaskTransformed;
  options?: GanttBarOptions;
  interaction?: GanttInteractionConfig;
}

/** No options at all is the plain chart - one shared object keeps the default identity stable */
const NO_OPTIONS: GanttBarOptions = {};

/** Human duration for the default hover tooltip */
function formatDuration(durationMs: number): string {
  const hours = Math.max(0, Math.round(durationMs / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export default function GanttBar({
  currentTask,
  options = NO_OPTIONS,
  interaction,
}: GanttBarProps) {
  const {
    onTasksChange,
    onBeforeTaskChange,
    onTaskClick,
    onTaskDoubleClick,
    renderBar,
    renderTooltip,
    showTooltip = true,
  } = options;

  const barRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, dragMode, consumeDragClick } = useGanttBarDrag(
    currentTask,
    { onTasksChange, onBeforeTaskChange },
    interaction
  );
  const { canMove, canResize, canChangeProgress } = resolveTaskInteraction(
    currentTask,
    interaction
  );
  // Only the pointer position is tracked here - the cursor itself is derived below,
  // so a permission that changes after mount cannot leave a stale affordance behind
  const [onResizeEdge, setOnResizeEdge] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Read the drag offset
  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.currentTask?.id === currentTask.id);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const isSelected = useGanttStore(
    (store) => store.selectedTaskId === currentTask.id
  );
  // Set while a vetoed change animates back to where the gesture started
  const isReverting = useGanttStore((store) =>
    store.revertingIds.includes(currentTask.id)
  );

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
    useGanttProgressDrag(currentTask, barRef, {
      onTasksChange,
      onBeforeTaskChange,
    });
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // The click that closes a drag is the end of that gesture, not a selection
    if (consumeDragClick()) return;
    onTaskClick?.(currentTask, e);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onTaskDoubleClick?.(currentTask, e);
  };

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

  // What the tooltip is for, most specific first - a gesture in progress beats a hover
  const tooltipReason: GanttTooltipReason | null = !showTooltip
    ? null
    : isDraggingProgress
      ? "progress"
      : isDragging && liveOffset
        ? dragMode === "left" || dragMode === "right"
          ? "resize"
          : "move"
        : hovered
          ? "hover"
          : null;

  const renderTooltipNode = () => {
    if (!tooltipReason) return null;

    const isGesture = tooltipReason !== "hover";
    const startDate =
      isGesture && liveOffset
        ? liveOffset.offsetStartDate
        : dayjs(currentTask.startDate);
    const endDate = isMilestone
      ? startDate
      : isGesture && liveOffset
        ? liveOffset.offsetEndDate
        : dayjs(currentTask.endDate);

    if (renderTooltip) {
      return renderTooltip({
        task: currentTask,
        reason: tooltipReason,
        startDate,
        endDate,
        durationMs: endDate.valueOf() - startDate.valueOf(),
        progress,
        scale: selectedScale,
      });
    }

    // Gesture tooltips are a single live line; the hover one is the task's summary
    if (tooltipReason === "progress") {
      return (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {progress}%
        </div>
      );
    }

    if (isGesture) {
      return (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {getTooltipText(dragMode)}
        </div>
      );
    }

    return (
      <div className="gantt-bar-tooltip gantt-bar-tooltip-detail" role="tooltip">
        <span className="gantt-tooltip-name">{currentTask.name}</span>
        <span className="gantt-tooltip-meta">
          {isMilestone
            ? tooltip(startDate)
            : `${tooltip(startDate)} → ${tooltip(endDate)}`}
        </span>
        {!isMilestone && (
          <span className="gantt-tooltip-meta">
            {formatDuration(endDate.valueOf() - startDate.valueOf())}
            {progress !== null ? ` · ${progress}%` : ""}
          </span>
        )}
      </div>
    );
  };

  const colorVars = resolveTaskColors(currentTask.color) as CSSProperties;

  const barStyle: CSSProperties = isMilestone
    ? {
        transform: `translateX(${finalLeft - MILESTONE_HALF_DIAGONAL}px)`,
        height: NODE_HEIGHT / 2,
        cursor: barCursor,
        ...colorVars,
      }
    : {
        transform: `translateX(${finalLeft}px)`,
        width: finalWidth,
        height: NODE_HEIGHT / 2,
        cursor: barCursor,
        ...colorVars,
      };

  // A replacement owns the whole node, tooltip included - it gets the layout it needs plus
  // the handlers, so drag, click and double-click keep working when they are spread on
  if (renderBar) {
    return (
      <>
        {renderBar({
          task: currentTask,
          left: finalLeft,
          width: finalWidth,
          height: NODE_HEIGHT / 2,
          progress,
          scale: selectedScale,
          isMilestone,
          isSummary: Boolean(currentTask.isSummary),
          isDragging,
          isSelected,
          barProps: {
            style: barStyle,
            onPointerDown,
            onClick: handleClick,
            onDoubleClick: handleDoubleClick,
          },
        })}
      </>
    );
  }

  // Appended after the existing classes so a plain task still reads exactly as before
  const extraClasses = [
    isSelected ? "selected" : "",
    isReverting ? "reverting" : "",
    currentTask.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const suffix = extraClasses ? ` ${extraClasses}` : "";

  // Milestone: a diamond at the single startDate point, with a label to its right
  if (isMilestone) {
    return (
      <div
        ref={barRef}
        id={`task-${currentTask.id}`}
        className={`gantt-milestone${isDragging ? " dragging" : ""}${suffix}`}
        onPointerDown={onPointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={barStyle}
        role="button"
        tabIndex={0}
        aria-label={`Milestone: ${currentTask.name}`}
      >
        <div className="gantt-milestone-diamond" />
        <span className="gantt-milestone-name">{currentTask.name}</span>

        {renderTooltipNode()}
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
      }${suffix}`}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setOnResizeEdge(false);
        setHovered(false);
      }}
      style={barStyle}
      role="button"
      tabIndex={0}
      aria-label={
        showProgress
          ? `Task: ${currentTask.name}, ${progress}% complete`
          : `Task: ${currentTask.name}`
      }
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

      {renderTooltipNode()}
    </div>
  );
}
