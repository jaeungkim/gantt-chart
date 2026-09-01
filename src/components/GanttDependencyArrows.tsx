import { NODE_HEIGHT } from "constants/gantt";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useCallback, useId, useMemo, useRef } from "react";
import { useGanttStore } from "stores/context";
import { TaskTransformed } from "types/task";
import {
  ArrowViewport,
  buildDependencies,
  buildTaskIndex,
  getSmartGanttPath,
  isArrowVisible,
} from "utils/arrowPath";

interface Props {
  transformedTasks: TaskTransformed[];
}

export default function GanttDependencyArrows({
  transformedTasks,
}: Props) {
  const liveOffsets = useGanttStore((store) => store.dragOffsets);
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);

  // 스크롤 컨테이너는 SVG의 조상이라 마운트 시 직접 찾는다.
  // 바 컬링과 같은 가상화 창을 써야 화살표만 먼저 잘리는 일이 없다.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const attachSvg = useCallback((svg: SVGSVGElement | null) => {
    scrollRef.current =
      svg?.closest<HTMLDivElement>(".gantt-scroll-container") ?? null;
  }, []);

  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    transformedTasks,
    bottomRowCells,
    scrollRef,
  });

  // 태스크 인덱스는 데이터가 바뀔 때만 다시 만든다 (드래그 프레임마다가 아니라)
  const taskById = useMemo(
    () => buildTaskIndex(transformedTasks),
    [transformedTasks]
  );

  // 화면 밖 화살표는 만들지 않는다 - 행은 이미 가상화되어 있어서
  // 대량 데이터에서는 화살표가 실질적인 한계였다
  const visibleRows = rowVirtualizer.getVirtualItems();
  const lastRow = visibleRows[visibleRows.length - 1];
  const viewport: ArrowViewport = {
    topPx: visibleRows[0]?.start ?? 0,
    bottomPx: lastRow ? lastRow.start + lastRow.size : 0,
    isBarVisible,
  };

  const dependencies = buildDependencies(taskById, liveOffsets).filter((dep) =>
    isArrowVisible(dep, viewport)
  );

  // marker id는 문서 전역이라 인스턴스마다 고유해야 차트를 여러 개 띄워도 안 섞인다
  // useId 값에는 url(#...) 참조에 부적합한 문자가 섞이므로 영숫자만 남긴다
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowheadId = `gantt-arrowhead-${instanceId}`;

  return (
    <svg
      ref={attachSvg}
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
