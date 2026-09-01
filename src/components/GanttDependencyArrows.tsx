import { NODE_HEIGHT } from "constants/gantt";
import { useId } from "react";
import { useGanttStore } from "stores/store";
import { TaskTransformed } from "types/task";
import { buildDependencies, getSmartGanttPath } from "utils/arrowPath";

interface Props {
  transformedTasks: TaskTransformed[];
}

export default function GanttDependencyArrows({
  transformedTasks,
}: Props) {
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const dependencies = buildDependencies(transformedTasks, liveOffsets);

  // marker id는 문서 전역이라 인스턴스마다 고유해야 차트를 여러 개 띄워도 안 섞인다
  // useId 값에는 url(#...) 참조에 부적합한 문자가 섞이므로 영숫자만 남긴다
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowheadId = `gantt-arrowhead-${instanceId}`;

  return (
    <svg
      className="gantt-dependency-arrows"
      style={{
        height: `${transformedTasks.length * NODE_HEIGHT}px`,
      }}
    >
      <defs>
        <marker
          id={arrowheadId}
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
          markerEnd={`url(#${arrowheadId})`}
          fill="none"
        />
      ))}
    </svg>
  );
}
