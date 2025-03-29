import HandleIcon from 'assets/images/icons/handle.svg?react';
import { NODE_HEIGHT } from 'constants/gantt';
import {
  useGanttBarDrag,
  useGanttBarLeftHandleDrag,
  useGanttBarRightHandleDrag,
} from 'hooks/useGanttBarDrag';
import { useGanttStore } from 'stores/store';
import { RenderedDependency, Task, TaskTransformed } from 'types/task';
import { getSmartGanttPath } from 'utils/arrowPath';

interface GanttBarProps {
  allTasks: TaskTransformed[];
  currentTask: TaskTransformed;
  onTasksChange?: (updatedTask: Task[]) => void;
}

function GanttBar({ allTasks, currentTask, onTasksChange }: GanttBarProps) {
  const { onDragStart: onBarDragStart, tempLeft: tempLeftForBar } =
    useGanttBarDrag(currentTask, currentTask.barLeft, onTasksChange);

  const {
    onDragStart: onLeftHandleDragStart,
    tempLeft: tempLeftForLeft,
    tempWidth: tempWidthForLeft,
  } = useGanttBarLeftHandleDrag(
    currentTask,
    currentTask.barLeft,
    currentTask.barWidth,
    onTasksChange,
  );

  const { onDragStart: onRightHandleDragStart, tempWidth: tempWidthForRight } =
    useGanttBarRightHandleDrag(
      currentTask,
      currentTask.barWidth,
      onTasksChange,
    );

  // Drag state detection
  const { draggingTaskMeta } = useGanttStore();
  const isDraggingThis = draggingTaskMeta?.taskId === currentTask.id;

  let isLeftDragging = false;
  let isRightDragging = false;
  let isBarDragging = false;

  if (isDraggingThis) {
    if (draggingTaskMeta?.type === 'left') isLeftDragging = true;
    else if (draggingTaskMeta?.type === 'right') isRightDragging = true;
    else if (draggingTaskMeta?.type === 'bar') isBarDragging = true;
  }

  // Resolve current visual geometry
  let barLeft = currentTask.barLeft;
  let barWidth = currentTask.barWidth;

  if (isLeftDragging) {
    barLeft = tempLeftForLeft;
    barWidth = tempWidthForLeft;
  } else if (isRightDragging) {
    barWidth = tempWidthForRight;
  } else if (isBarDragging) {
    barLeft = tempLeftForBar;
  }

  const renderLeftHandle = () => (
    <button
      type="button"
      onMouseDown={onLeftHandleDragStart}
      className="absolute top-0 flex h-full cursor-w-resize items-center justify-center opacity-0 hover:opacity-100"
      style={{
        left: '-1.15rem',
        width: '2rem',
        height: '100%',
      }}
    >
      <HandleIcon
        className="size-6"
        style={{
          fill: '#919294',
        }}
      />
    </button>
  );

  const renderRightHandle = () => (
    <button
      type="button"
      onMouseDown={onRightHandleDragStart}
      className="absolute top-0 flex h-full cursor-w-resize items-center justify-center opacity-0 hover:opacity-100"
      style={{
        right: '-1.15rem',
        width: '2rem',
        height: '100%',
      }}
    >
      <HandleIcon
        className="size-6"
        style={{
          fill: '#919294',
        }}
      />
    </button>
  );

  const renderedDependencies: RenderedDependency[] = (
    currentTask.dependencies || []
  )
    .map((dep) => {
      const dependencyNode = allTasks.find((t) => t.id === dep.targetId);
      if (!dependencyNode) return null;

      const rowHeightInPx = NODE_HEIGHT;
      const fromY =
        (dependencyNode.order - 1) * rowHeightInPx + rowHeightInPx / 2;
      const toY = (currentTask.order - 1) * rowHeightInPx + rowHeightInPx / 2;

      let fromX: number;
      let toX: number;

      switch (dep.type) {
        case 'FS':
          fromX = dependencyNode.barLeft + dependencyNode.barWidth;
          toX = currentTask.barLeft;
          break;
        case 'SS':
          fromX = dependencyNode.barLeft;
          toX = currentTask.barLeft;
          break;
        case 'FF':
          fromX = dependencyNode.barLeft + dependencyNode.barWidth;
          toX = currentTask.barLeft + currentTask.barWidth;
          break;
        case 'SF':
          fromX = dependencyNode.barLeft;
          toX = currentTask.barLeft + currentTask.barWidth;
          break;
        default:
          console.warn(`Unknown dependency type: ${dep.type}`);
          return null;
      }

      return {
        ...dep,
        fromX,
        fromY,
        toX,
        toY,
      };
    })
    .filter(Boolean) as RenderedDependency[];

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="relative flex items-center"
        onMouseDown={onBarDragStart}
        style={{
          backgroundColor: '#D6D6D8',
          marginLeft: `${barLeft}px`,
          width: `${barWidth}px`,
          height: `1rem`,
        }}
      >
        {renderLeftHandle()}
        {renderRightHandle()}
      </div>

      <svg className="pointer-events-none absolute top-0 left-0 z-10 size-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5.25"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 6 3, 0 6" fill="#000" />
          </marker>
        </defs>
        {renderedDependencies.map((dep, index) => (
          <path
            key={index}
            d={getSmartGanttPath(
              dep.type,
              dep.fromX,
              dep.fromY,
              dep.toX,
              dep.toY,
            )}
            fill="none"
            markerEnd="url(#arrowhead)"
            style={{ stroke: '#000', strokeWidth: 0.75 }}
          />
        ))}
      </svg>
    </>
  );
}

export default GanttBar;
