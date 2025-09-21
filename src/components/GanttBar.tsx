import { NODE_HEIGHT } from "constants/gantt";
import { useGanttBarDrag } from "hooks/useGanttBarDrag";
import { useRef, useState } from "react";
import { useGanttStore } from "stores/store";
import { Task, TaskTransformed } from "types/task";
import DragHandle from "./DragHandle";

interface GanttBarProps {
  currentTask: TaskTransformed;
  onTasksChange?: (updatedTasks: Task[]) => void;
}

export default function GanttBar({
  currentTask,
  onTasksChange,
}: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const { onPointerDown } = useGanttBarDrag(currentTask, onTasksChange);
  const [hoveredHandle, setHoveredHandle] = useState<"none" | "left" | "right">("none");

  // Get drag offset with fallback
  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  // Calculate final position and dimensions
  const finalLeft = currentTask.barLeft + offsetX;
  const finalWidth = currentTask.barWidth + offsetWidth;

  return (
    <div
      ref={barRef}
      id={`task-${currentTask.id}`}
      className="gantt-task-bar"
      onPointerDown={onPointerDown}
      style={{
        transform: `translateX(${finalLeft}px)`,
        width: finalWidth,
        height: NODE_HEIGHT / 2,
      }}
    >
      <DragHandle
        side="left"
        hoveredHandle={hoveredHandle}
        setHoveredHandle={setHoveredHandle}
      />
      <DragHandle
        side="right"
        hoveredHandle={hoveredHandle}
        setHoveredHandle={setHoveredHandle}
      />
    </div>
  );
}
