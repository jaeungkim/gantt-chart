import { NODE_HEIGHT } from 'constants/gantt';
import { useGanttStore } from 'stores/store';
import { RenderedDependency, TaskTransformed } from 'types/task';
import { getSmartGanttPath } from 'utils/arrowPath';

interface Props {
  transformedTasks: TaskTransformed[];
  visibleRowIndexes: number[];
}

export default function GanttDependencyArrows({
  transformedTasks,
  visibleRowIndexes,
}: Props) {
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const visibleRowSet = new Set(visibleRowIndexes);

  const dependencies: RenderedDependency[] = [];

  for (const currentTask of transformedTasks) {
    const sourceIndex = currentTask.order - 1;

    // Only render arrows for tasks in visible range
    if (!visibleRowSet.has(sourceIndex)) continue;

    const offset = liveOffsets[currentTask.id];
    const offsetX = offset?.offsetX ?? 0;
    const offsetWidth = offset?.offsetWidth ?? 0;

    for (const dep of currentTask.dependencies ?? []) {
      const targetTask = transformedTasks.find((t) => t.id === dep.targetId);
      if (!targetTask) continue;

      const targetIndex = targetTask.order - 1;

      // Optional: if you want to render arrows only when target is also visible
      // if (!visibleRowSet.has(sourceIndex) && !visibleRowSet.has(targetIndex)) continue;

      const rowHeight = NODE_HEIGHT;
      const fromY = targetIndex * rowHeight + rowHeight / 2 - 4;
      const toY = sourceIndex * rowHeight + rowHeight / 2 + 4;

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

      dependencies.push({ ...dep, fromX, fromY, toX, toY });
    }
  }

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
