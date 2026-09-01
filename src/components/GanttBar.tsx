import {
  DATE_FORMATS,
  EDGE_THRESHOLD,
  MILESTONE_HALF_DIAGONAL,
  MIN_BAR_WIDTH,
  MIN_LABEL_INSIDE_WIDTH,
  MIN_RESIZABLE_WIDTH,
  NODE_HEIGHT,
} from "constants/gantt";
import { useGanttBarDrag, DragMode } from "hooks/useGanttBarDrag";
import { useGanttProgressDrag } from "hooks/useGanttProgressDrag";
import { useRef, useState, useCallback } from "react";
import { useGanttStore } from "stores/context";
import { isMilestoneTask, Task, TaskTransformed } from "types/task";

interface GanttBarProps {
  currentTask: TaskTransformed;
  onTasksChange?: (updatedTasks: Task[]) => void;
}

export default function GanttBar({
  currentTask,
  onTasksChange,
}: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, dragMode } = useGanttBarDrag(currentTask, onTasksChange);
  const [cursor, setCursor] = useState<"grab" | "ew-resize">("grab");

  // Read the drag offset
  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.currentTask?.id === currentTask.id);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  
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

  // Change the cursor based on the mouse position (milestones cannot be resized)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMilestone) return;

      const bar = barRef.current;
      if (!bar) return;

      const rect = bar.getBoundingClientRect();
      if (rect.width < MIN_RESIZABLE_WIDTH) {
        setCursor("grab");
        return;
      }

      const relativeX = e.clientX - rect.left;

      if (
        relativeX <= EDGE_THRESHOLD ||
        relativeX >= rect.width - EDGE_THRESHOLD
      ) {
        setCursor("ew-resize");
      } else {
        setCursor("grab");
      }
    },
    [isMilestone]
  );

  // Build the tooltip text (shown differently per mode)
  const format = DATE_FORMATS[selectedScale];
  const getTooltipText = (mode: DragMode | null) => {
    if (!liveOffset) return "";

    const startText = liveOffset.offsetStartDate.format(format);
    const endText = liveOffset.offsetEndDate.format(format);

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
          cursor: isDragging ? "grabbing" : "grab",
        }}
        role="button"
        tabIndex={0}
        aria-label={`Milestone: ${currentTask.name}`}
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
      }`}
      onPointerDown={onPointerDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCursor("grab")}
      style={{
        transform: `translateX(${finalLeft}px)`,
        width: finalWidth,
        height: NODE_HEIGHT / 2,
        cursor: isDragging ? "grabbing" : cursor,
      }}
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
