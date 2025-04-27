import HandleIcon from 'assets/images/icons/handle.svg?react';
import { NODE_HEIGHT } from 'constants/gantt';
import { useGanttBarDrag } from 'hooks/useGanttBarDrag';
import { useRef, useState } from 'react';
import { RenderedDependency, Task, TaskTransformed } from 'types/task';
import { getSmartGanttPath } from 'utils/arrowPath';

interface GanttBarProps {
  allTasks: TaskTransformed[];
  currentTask: TaskTransformed;
  onTasksChange?: (tasks: Task[]) => void;
}

function GanttBar({ allTasks, currentTask, onTasksChange }: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useGanttBarDrag(barRef as any, currentTask, onTasksChange);

  const [hover, setHover] = useState<'none' | 'left' | 'right'>('none');

  const renderedDependencies: RenderedDependency[] = (
    currentTask.dependencies ?? []
  )
    .map((dep) => {
      const depNode = allTasks.find((t) => t.id === dep.targetId);
      if (!depNode) return null;

      const rowH = NODE_HEIGHT;
      const fromY = (depNode.order - 1) * rowH + rowH / 2 - 4;
      const toY = (currentTask.order - 1) * rowH + rowH / 2 + 4;

      const l = depNode.barLeft,
        r = depNode.barLeft + depNode.barWidth;
      const L = currentTask.barLeft,
        R = currentTask.barLeft + currentTask.barWidth;

      const [fromX, toX] = (
        {
          FS: [r, L],
          SS: [l, L],
          FF: [r, R],
          SF: [l, R],
        } as const
      )[dep.type];

      return { ...dep, fromX, fromY, toX, toY };
    })
    .filter(Boolean) as RenderedDependency[];

  return (
    <>
      <div
        ref={barRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: '#D6D6D8',
          transform: `translateX(${currentTask.barLeft}px)`,
          width: `${currentTask.barWidth}px`,
          height: '16px',
        }}
      >
        <button
          data-mode="left"
          onMouseEnter={() => setHover('left')}
          onMouseLeave={() => setHover('none')}
          style={handleStyle('left')}
        >
          <HandleIcon style={iconStyle(hover === 'left')} />
        </button>

        <button
          data-mode="right"
          onMouseEnter={() => setHover('right')}
          onMouseLeave={() => setHover('none')}
          style={handleStyle('right')}
        >
          <HandleIcon style={iconStyle(hover === 'right')} />
        </button>
      </div>

      <svg style={svgStyle}>
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
        {renderedDependencies.map((d, i) => (
          <path
            key={i}
            d={getSmartGanttPath(d.type, d.fromX, d.fromY, d.toX, d.toY)}
            fill="none"
            markerEnd="url(#arrowhead)"
            style={{ stroke: '#000', strokeWidth: 0.75 }}
          />
        ))}
      </svg>
    </>
  );
}

const handleStyle = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  [side]: '-18.4px',
  width: '32px',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'w-resize',
  background: 'transparent',
  border: 'none',
  padding: 0,
});

const iconStyle = (visible: boolean): React.CSSProperties => ({
  width: '24px',
  height: '24px',
  fill: '#919294',
  opacity: visible ? 1 : 0,
});

const svgStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: 10,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

export default GanttBar;
