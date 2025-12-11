import { NODE_HEIGHT } from "constants/gantt";
import { useGanttBarDrag, DragMode } from "hooks/useGanttBarDrag";
import { useRef, useState, useCallback } from "react";
import { useGanttStore } from "stores/store";
import { GanttScaleKey } from "types/gantt";
import { Task, TaskTransformed } from "types/task";

// 엣지 감지 영역 (px)
const EDGE_THRESHOLD = 8;

// 스케일별 날짜 포맷
const DATE_FORMATS: Record<GanttScaleKey, string> = {
  day: "MMM D, h A",
  week: "MMM D",
  month: "MMM D",
  year: "MMM YYYY",
};

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
  const finalLeft = currentTask.barLeft + offsetX;
  const finalWidth = currentTask.barWidth + offsetWidth;

  // 마우스 위치에 따른 커서 변경
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;

    if (relativeX <= EDGE_THRESHOLD || relativeX >= rect.width - EDGE_THRESHOLD) {
      setCursor("ew-resize");
    } else {
      setCursor("grab");
    }
  }, []);

  // 툴팁 텍스트 생성 (모드에 따라 다르게 표시)
  const format = DATE_FORMATS[selectedScale];
  const getTooltipText = (mode: DragMode | null) => {
    if (!liveOffset) return "";
    
    const startText = liveOffset.offsetStartDate.format(format);
    const endText = liveOffset.offsetEndDate.format(format);
    
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

  return (
    <div
      ref={barRef}
      id={`task-${currentTask.id}`}
      className={`gantt-task-bar${isDragging ? " dragging" : ""}`}
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
      <span className="gantt-task-name">{currentTask.name}</span>
      
      {/* 드래그 중 툴팁 */}
      {isDragging && liveOffset && (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {getTooltipText(dragMode)}
        </div>
      )}
    </div>
  );
}
