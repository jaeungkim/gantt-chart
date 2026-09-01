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
import { useRef, useState, useCallback } from "react";
import { useGanttStore } from "stores/store";
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

  // 드래그 오프셋 가져오기
  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.currentTask?.id === currentTask.id);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  
  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  // 최종 위치 및 크기 계산
  // 짧은 태스크도 잡을 수 있도록 최소 너비 보장, 좁으면 라벨을 바 밖으로
  const finalLeft = currentTask.barLeft + offsetX;
  const finalWidth = Math.max(
    currentTask.barWidth + offsetWidth,
    MIN_BAR_WIDTH
  );
  const labelOutside = finalWidth < MIN_LABEL_INSIDE_WIDTH;

  const isMilestone = isMilestoneTask(currentTask);

  // 마우스 위치에 따른 커서 변경 (마일스톤은 리사이즈 없음)
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

  // 툴팁 텍스트 생성 (모드에 따라 다르게 표시)
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

  // 마일스톤: startDate 한 점에 다이아몬드 + 우측 라벨
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
        aria-label={`마일스톤: ${currentTask.name}`}
      >
        <div className="gantt-milestone-diamond" />
        <span className="gantt-milestone-name">{currentTask.name}</span>

        {/* 드래그 중 툴팁 */}
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
      aria-label={`태스크: ${currentTask.name}`}
    >
      <span
        className={`gantt-task-name${labelOutside ? " outside" : ""}`}
      >
        {currentTask.name}
      </span>

      {/* 드래그 중 툴팁 */}
      {isDragging && liveOffset && (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {getTooltipText(dragMode)}
        </div>
      )}
    </div>
  );
}
