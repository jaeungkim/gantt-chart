import { NODE_HEIGHT } from "constants/gantt";
import { useGanttStore } from "stores/store";
import { RenderedDependency, TaskTransformed } from "types/task";
import { getSmartGanttPath } from "utils/arrowPath";

interface Props {
  transformedTasks: TaskTransformed[];
  visibleRowIndexes: number[];
}

// Helper function to calculate arrow coordinates
function calculateArrowCoords(
  sourceTask: TaskTransformed,
  targetTask: TaskTransformed,
  sourceOffset: { offsetX: number; offsetWidth: number },
  depType: string
) {
  const rowHeight = NODE_HEIGHT;
  const sourceIndex = sourceTask.order - 1;
  const targetIndex = targetTask.order - 1;

  const fromY = targetIndex * rowHeight + rowHeight / 2 - 4;
  const toY = sourceIndex * rowHeight + rowHeight / 2 + 4;

  const leftX = targetTask.barLeft;
  const rightX = targetTask.barLeft + targetTask.barWidth;

  const currentLeftX = sourceTask.barLeft + sourceOffset.offsetX;
  const currentRightX = currentLeftX + sourceTask.barWidth + sourceOffset.offsetWidth;

  const coordinateMap = {
    FS: [rightX, currentLeftX] as const,
    SS: [leftX, currentLeftX] as const,
    FF: [rightX, currentRightX] as const,
    SF: [leftX, currentRightX] as const,
  };

  const [fromX, toX] = coordinateMap[depType as keyof typeof coordinateMap];

  return { fromX, fromY, toX, toY };
}

// Helper function to build dependencies array
function buildDependencies(
  transformedTasks: TaskTransformed[],
  visibleRowSet: Set<number>,
  liveOffsets: Record<string, { offsetX: number; offsetWidth: number }>
): RenderedDependency[] {
  const dependencies: RenderedDependency[] = [];

  for (const currentTask of transformedTasks) {
    const sourceIndex = currentTask.order - 1;
    if (!visibleRowSet.has(sourceIndex)) continue;

    const offset = liveOffsets[currentTask.id] ?? { offsetX: 0, offsetWidth: 0 };

    for (const dep of currentTask.dependencies ?? []) {
      const targetTask = transformedTasks.find((t) => t.id === dep.targetId);
      if (!targetTask) continue;

      const { fromX, fromY, toX, toY } = calculateArrowCoords(
        currentTask,
        targetTask,
        offset,
        dep.type
      );

      dependencies.push({ ...dep, fromX, fromY, toX, toY });
    }
  }

  return dependencies;
}

export default function GanttDependencyArrows({
  transformedTasks,
  visibleRowIndexes,
}: Props) {
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const visibleRowSet = new Set(visibleRowIndexes);
  const dependencies = buildDependencies(transformedTasks, visibleRowSet, liveOffsets);

  return (
    <svg
      className="gantt-dependency-arrows"
      style={{
        height: `${transformedTasks.length * NODE_HEIGHT}px`,
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
          key={`arrow-${index}`}
          className="gantt-dependency-arrow"
          d={getSmartGanttPath(
            dep.type,
            dep.fromX,
            dep.fromY,
            dep.toX,
            dep.toY
          )}
          markerEnd="url(#arrowhead)"
          fill="none"
        />
      ))}
    </svg>
  );
}
