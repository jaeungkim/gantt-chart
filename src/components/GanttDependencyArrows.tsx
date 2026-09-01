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

  // The scroll container is an ancestor of the SVG, so it is looked up on mount.
  // Using the same virtualization window as the bar culling keeps arrows from being
  // culled ahead of the bars.
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

  // The task index is rebuilt only when the data changes (not on every drag frame)
  const taskById = useMemo(
    () => buildTaskIndex(transformedTasks),
    [transformedTasks]
  );

  // Arrows outside the viewport are never built - the rows are already virtualized, so on
  // large data sets the arrows were the real limit
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

  // Marker ids are document-global, so each instance needs its own or several charts on a
  // page would mix them up
  // useId values contain characters that are invalid in a url(#...) reference, so only
  // alphanumerics are kept
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
