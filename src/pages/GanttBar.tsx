import HandleIcon from 'assets/images/icons/handle.svg?react';
import { NODE_HEIGHT } from 'constants/gantt';
import {
  useGanttBarDrag,
  useGanttBarLeftHandleDrag,
  useGanttBarRightHandleDrag,
} from 'hooks/useGanttBarDrag';
import { useState } from 'react';
import { useGanttStore } from 'stores/store';
import { RenderedDependency, Task, TaskTransformed } from 'types/task';
import { getSmartGanttPath } from 'utils/arrowPath';

interface GanttBarProps {
  allTasks: TaskTransformed[];
  currentTask: TaskTransformed;
  onTasksChange?: (updatedTask: Task[]) => void;
}

function GanttBar({ allTasks, currentTask, onTasksChange }: GanttBarProps) {
  const [leftHovered, setLeftHovered] = useState(false);
  const [rightHovered, setRightHovered] = useState(false);

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
      onMouseEnter={() => setLeftHovered(true)}
      onMouseLeave={() => setLeftHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: '-1.15rem',
        width: '2rem',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'w-resize',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <HandleIcon
        style={{
          height: '1.5rem',
          width: '1.5rem',
          fill: '#919294',
          opacity: leftHovered ? 1 : 0,
          // transition: 'opacity 50ms ease-in-out',
        }}
      />
    </button>
  );

  const renderRightHandle = () => (
    <button
      type="button"
      onMouseDown={onRightHandleDragStart}
      onMouseEnter={() => setRightHovered(true)}
      onMouseLeave={() => setRightHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        right: '-1.15rem',
        width: '2rem',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'w-resize',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <HandleIcon
        style={{
          height: '1.5rem',
          width: '1.5rem',
          fill: '#919294',
          opacity: rightHovered ? 1 : 0,
          // transition: 'opacity 150ms ease-in-out',
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
        // className="relative flex items-center"
        onMouseDown={onBarDragStart}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#D6D6D8',
          marginLeft: `${barLeft}px`,
          width: `${barWidth}px`,
          height: `1rem`,
        }}
      >
        {renderLeftHandle()}
        {renderRightHandle()}
      </div>

      <svg
        // className="pointer-events-none absolute top-0 left-0 z-10 size-full"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 10,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
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
