import { NODE_HEIGHT } from "constants/gantt";
import { useGanttStore } from "stores/store";
import { RenderedDependency, TaskTransformed } from "types/task";
import { getSmartGanttPath } from "utils/arrowPath";

interface Props {
  transformedTasks: TaskTransformed[];
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

  // 바 중앙 높이에서 연결 (전통적인 Gantt 차트 스타일)
  const barCenterY = rowHeight / 2;
  const fromY = targetIndex * rowHeight + barCenterY;
  const toY = sourceIndex * rowHeight + barCenterY;

  const leftX = targetTask.barLeft;
  const rightX = targetTask.barLeft + targetTask.barWidth;

  const currentLeftX = sourceTask.barLeft + sourceOffset.offsetX;
  const currentRightX = currentLeftX + sourceTask.barWidth + sourceOffset.offsetWidth;

  // 의존성 타입에 따른 X 좌표 설정
  // FS: 선행 태스크 우측 → 후행 태스크 좌측
  // SS: 선행 태스크 좌측 → 후행 태스크 좌측
  // FF: 선행 태스크 우측 → 후행 태스크 우측
  // SF: 선행 태스크 좌측 → 후행 태스크 우측
  const coordinateMap = {
    FS: [rightX, currentLeftX] as const,
    SS: [leftX, currentLeftX] as const,
    FF: [rightX, currentRightX] as const,
    SF: [leftX, currentRightX] as const,
  };

  const [fromX, toX] = coordinateMap[depType as keyof typeof coordinateMap];

  return { fromX, fromY, toX, toY };
}

// 의존성 배열 빌드
function buildDependencies(
  transformedTasks: TaskTransformed[],
  liveOffsets: Record<string, { offsetX: number; offsetWidth: number }>
): RenderedDependency[] {
  const dependencies: RenderedDependency[] = [];

  for (const currentTask of transformedTasks) {
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
}: Props) {
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const dependencies = buildDependencies(transformedTasks, liveOffsets);

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
          markerWidth="5"
          markerHeight="5"
          refX="4.5"
          refY="2.5"
          orient="auto"
        >
          <polygon
            className="gantt-dependency-arrow-head"
            points="0 0, 5 2.5, 0 5"
          />
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
