import { NODE_HEIGHT } from 'constants/gantt';
import { useGanttBarDrag } from 'hooks/useGanttBarDrag';
import { useRef, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { Task, TaskTransformed } from 'types/task';
import DragHandle from './DragHandle';

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

  const liveOffset = useGanttStore(
    (store) => store.dragOffsets[currentTask.id],
  );
  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  const [hoveredHandle, setHoveredHandle] = useState<'none' | 'left' | 'right'>(
    'none',
  );

  return (
    <div
      ref={barRef}
      id={`task-${currentTask.id}`}
      onPointerDown={onPointerDown}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#D6D6D8',
        transform: `translateX(${currentTask.barLeft + offsetX}px)`,
        width: currentTask.barWidth + offsetWidth,
        height: NODE_HEIGHT / 2,
        userSelect: 'none',
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
