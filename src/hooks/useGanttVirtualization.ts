import { useVirtualizer, Virtualizer } from "@tanstack/react-virtual";
import { NODE_HEIGHT } from "constants/gantt";
import { RefObject, useEffect, useMemo } from "react";
import { GanttBottomRowCell } from "types/gantt";
import { TaskTransformed } from "types/task";

interface UseGanttColumnVirtualizationParams {
  bottomRowCells: GanttBottomRowCell[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

interface UseGanttColumnVirtualizationResult {
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
}

interface UseGanttVirtualizationParams
  extends UseGanttColumnVirtualizationParams {
  transformedTasks: TaskTransformed[];
}

interface UseGanttVirtualizationResult
  extends UseGanttColumnVirtualizationResult {
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
}

/**
 * Column virtualization
 *
 * Split out so that rendering the header's bottom time cells and judging horizontal
 * visibility use the same window - the header and the bars must not be culled by
 * different criteria.
 */
export function useGanttColumnVirtualization({
  bottomRowCells,
  scrollRef,
}: UseGanttColumnVirtualizationParams): UseGanttColumnVirtualizationResult {
  // The functions TanStack Virtual returns cannot be memoized, so the React Compiler
  // skips this hook - the row virtualization below already carries the same warning,
  // so this only silences the duplicate
  // eslint-disable-next-line react-hooks/incompatible-library
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: bottomRowCells.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => bottomRowCells[index]?.widthPx ?? 32,
    overscan: 5,
  });

  // Compute the visible area
  const virtualItems = columnVirtualizer.getVirtualItems();
  const visibleStartPx = virtualItems[0]?.start ?? 0;
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const visibleEndPx = lastVirtualItem
    ? lastVirtualItem.start + lastVirtualItem.size
    : 0;

  // Bar visibility check
  const isBarVisible = useMemo(() => {
    return (barLeft: number, barWidth: number): boolean => {
      const barRight = barLeft + barWidth;
      return barRight >= visibleStartPx && barLeft <= visibleEndPx;
    };
  }, [visibleStartPx, visibleEndPx]);

  // Update the column virtualizer's measurements when the cells change
  useEffect(() => {
    if (!bottomRowCells.length) return;

    const id = requestAnimationFrame(() => {
      columnVirtualizer.measure();
    });

    return () => cancelAnimationFrame(id);
  }, [bottomRowCells, columnVirtualizer]);

  return {
    columnVirtualizer,
    isBarVisible,
  };
}

/**
 * Hook managing the Gantt chart's virtualization
 * Sets up row and column virtualization and provides the visibility check
 */
export function useGanttVirtualization({
  transformedTasks,
  bottomRowCells,
  scrollRef,
}: UseGanttVirtualizationParams): UseGanttVirtualizationResult {
  // Row virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: transformedTasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => NODE_HEIGHT,
    overscan: 5,
  });

  const column = useGanttColumnVirtualization({ bottomRowCells, scrollRef });

  return {
    rowVirtualizer,
    ...column,
  };
}
