import { Dayjs } from "dayjs";
import { RefObject, useCallback, useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { calculateDateOffsetPx } from "utils/timeline";

/** scrollToX 옵션 */
export interface GanttScrollOptions {
  /** 부드럽게 이동할지 여부 (기본 true) */
  smooth?: boolean;
  /** 뷰포트 안에서 대상이 놓일 위치 (기본 'center') */
  align?: "start" | "center";
}

/** ref로 노출되는 명령형 API */
export interface GanttHandle {
  /** 특정 날짜로 가로 스크롤 */
  scrollToDate: (date: string | Date | Dayjs, options?: GanttScrollOptions) => void;
  /** 오늘로 가로 스크롤 */
  scrollToToday: (options?: GanttScrollOptions) => void;
  /** 특정 태스크로 가로/세로 스크롤 */
  scrollToTask: (taskId: string, options?: GanttScrollOptions) => void;
  /** 스크롤 컨테이너 DOM 노드 (없으면 null) */
  getScrollElement: () => HTMLDivElement | null;
}

interface UseGanttScrollApiParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
  selectedScale: GanttScaleKey;
  rowHeight: number;
}

/**
 * 명령형 스크롤 API
 *
 * 타임라인 밖의 날짜나 없는 태스크 id는 조용히 무시한다 - 데이터 로딩 중
 * 호출하는 흔한 경우에 예외를 던지지 않기 위해서다.
 */
export function useGanttScrollApi({
  scrollRef,
  bottomRowCells,
  transformedTasks,
  selectedScale,
  rowHeight,
}: UseGanttScrollApiParams): GanttHandle {
  const scrollToOffset = useCallback(
    (left: number, options?: GanttScrollOptions) => {
      const el = scrollRef.current;
      if (!el) return;

      const target =
        options?.align === "start" ? left : left - el.clientWidth / 2;

      el.scrollTo({
        left: Math.max(0, target),
        behavior: options?.smooth === false ? "auto" : "smooth",
      });
    },
    [scrollRef]
  );

  const scrollToDate = useCallback(
    (date: string | Date | Dayjs, options?: GanttScrollOptions) => {
      const px = calculateDateOffsetPx(dayjs(date), bottomRowCells, selectedScale);
      if (px === null) return;

      scrollToOffset(px, options);
    },
    [bottomRowCells, selectedScale, scrollToOffset]
  );

  const scrollToToday = useCallback(
    (options?: GanttScrollOptions) => scrollToDate(dayjs(), options),
    [scrollToDate]
  );

  const scrollToTask = useCallback(
    (taskId: string, options?: GanttScrollOptions) => {
      const index = transformedTasks.findIndex((task) => task.id === taskId);
      if (index === -1) return;

      const task = transformedTasks[index];
      const el = scrollRef.current;
      if (!el) return;

      // 세로: 해당 행이 뷰포트 밖일 때만 움직인다 (보이는 행을 굳이 재배치하지 않음)
      const rowTop = index * rowHeight;
      const outOfView =
        rowTop < el.scrollTop ||
        rowTop + rowHeight > el.scrollTop + el.clientHeight;

      el.scrollTo({
        top: outOfView
          ? Math.max(0, rowTop - el.clientHeight / 2 + rowHeight / 2)
          : el.scrollTop,
        left: Math.max(
          0,
          options?.align === "start"
            ? task.barLeft
            : task.barLeft + task.barWidth / 2 - el.clientWidth / 2
        ),
        behavior: options?.smooth === false ? "auto" : "smooth",
      });
    },
    [transformedTasks, rowHeight, scrollRef]
  );

  return useMemo(
    () => ({
      scrollToDate,
      scrollToToday,
      scrollToTask,
      getScrollElement: () => scrollRef.current,
    }),
    [scrollToDate, scrollToToday, scrollToTask, scrollRef]
  );
}
