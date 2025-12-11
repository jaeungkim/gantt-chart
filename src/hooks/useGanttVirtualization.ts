import { useVirtualizer, Virtualizer } from "@tanstack/react-virtual";
import { NODE_HEIGHT } from "constants/gantt";
import { RefObject, useEffect, useMemo } from "react";
import { GanttBottomRowCell } from "types/gantt";
import { TaskTransformed } from "types/task";

interface UseGanttVirtualizationParams {
  transformedTasks: TaskTransformed[];
  bottomRowCells: GanttBottomRowCell[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

interface UseGanttVirtualizationResult {
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
}

/**
 * Gantt 차트의 가상화 로직을 관리하는 훅
 * 행(row)과 열(column) 가상화를 설정하고 가시성 체크 함수 제공
 */
export function useGanttVirtualization({
  transformedTasks,
  bottomRowCells,
  scrollRef,
}: UseGanttVirtualizationParams): UseGanttVirtualizationResult {
  // 행 가상화 설정
  const rowVirtualizer = useVirtualizer({
    count: transformedTasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => NODE_HEIGHT,
    overscan: 5,
  });

  // 열 가상화 설정
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: bottomRowCells.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => bottomRowCells[index]?.widthPx ?? 32,
    overscan: 5,
  });

  // 가시 영역 계산
  const virtualItems = columnVirtualizer.getVirtualItems();
  const visibleStartPx = virtualItems[0]?.start ?? 0;
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const visibleEndPx = lastVirtualItem
    ? lastVirtualItem.start + lastVirtualItem.size
    : 0;

  // 바 가시성 체크 함수
  const isBarVisible = useMemo(() => {
    return (barLeft: number, barWidth: number): boolean => {
      const barRight = barLeft + barWidth;
      return barRight >= visibleStartPx && barLeft <= visibleEndPx;
    };
  }, [visibleStartPx, visibleEndPx]);

  // 셀 변경 시 열 가상화 측정 업데이트
  useEffect(() => {
    if (!bottomRowCells.length) return;

    const id = requestAnimationFrame(() => {
      columnVirtualizer.measure();
    });

    return () => cancelAnimationFrame(id);
  }, [bottomRowCells, columnVirtualizer]);

  return {
    rowVirtualizer,
    columnVirtualizer,
    isBarVisible,
  };
}
