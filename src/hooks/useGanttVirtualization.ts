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
 * 열(column) 가상화
 *
 * 헤더의 하단 시간 셀 렌더와 가로 가시성 판정을 같은 창(window)으로 맞추기 위해
 * 따로 떼어 두었다 - 헤더와 바가 서로 다른 기준으로 잘리면 안 된다.
 */
export function useGanttColumnVirtualization({
  bottomRowCells,
  scrollRef,
}: UseGanttColumnVirtualizationParams): UseGanttColumnVirtualizationResult {
  // TanStack Virtual이 돌려주는 함수는 메모이즈할 수 없어 React Compiler가
  // 이 훅을 건너뛴다 - 아래 행 가상화에 같은 경고가 이미 남아 있어 중복만 끈다
  // eslint-disable-next-line react-hooks/incompatible-library
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
    columnVirtualizer,
    isBarVisible,
  };
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

  const column = useGanttColumnVirtualization({ bottomRowCells, scrollRef });

  return {
    rowVirtualizer,
    ...column,
  };
}
