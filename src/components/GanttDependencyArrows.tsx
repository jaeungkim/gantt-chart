import { NODE_HEIGHT } from 'constants/gantt';
import { useGanttStore } from 'stores/store';
import { RenderedDependency, TaskTransformed } from 'types/task';
import { getSmartGanttPath } from 'utils/arrowPath';

interface Props {
  transformedTasks: TaskTransformed[];
  currentTask: TaskTransformed;
}

export default function GanttDependencyArrows({
  transformedTasks,
  currentTask,
}: Props) {
  const liveOffset = useGanttStore(
    (store) => store.dragOffsets[currentTask.id],
  );
  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  const dependencies: RenderedDependency[] = (currentTask.dependencies ?? [])
    .map((dep) => {
      const targetTask = transformedTasks.find((t) => t.id === dep.targetId);
      if (!targetTask) return null;

      const rowHeight = NODE_HEIGHT;
      const fromY = (targetTask.order - 1) * rowHeight + rowHeight / 2 - 4;
      const toY = (currentTask.order - 1) * rowHeight + rowHeight / 2 + 4;

      const leftX = targetTask.barLeft;
      const rightX = targetTask.barLeft + targetTask.barWidth;

      const currentLeftX = currentTask.barLeft + offsetX;
      const currentRightX = currentLeftX + currentTask.barWidth + offsetWidth;

      const [fromX, toX] = (
        {
          FS: [rightX, currentLeftX],
          SS: [leftX, currentLeftX],
          FF: [rightX, currentRightX],
          SF: [leftX, currentRightX],
        } as const
      )[dep.type];

      return { ...dep, fromX, fromY, toX, toY };
    })
    .filter(Boolean) as RenderedDependency[];

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${transformedTasks.length * NODE_HEIGHT}px`,
        pointerEvents: 'none',
        zIndex: 5,
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
          <polygon points="0 0, 6 3, 0 6" />
        </marker>
      </defs>

      {dependencies.map((dep, index) => (
        <path
          key={index}
          d={getSmartGanttPath(
            dep.type,
            dep.fromX,
            dep.fromY,
            dep.toX,
            dep.toY,
          )}
          markerEnd="url(#arrowhead)"
          fill="none"
          style={{ stroke: '#000', strokeWidth: 0.75 }}
        />
      ))}
    </svg>
  );
}
