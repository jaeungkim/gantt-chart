import { Dayjs } from "dayjs";
import { RefObject, useCallback, useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { TaskTransformed } from "types/task";
import dayjs from "core/dates";
import { calculateDateOffsetPx } from "utils/timeline";

/** Options for the scrollTo* methods */
export interface GanttScrollOptions {
  /** Whether to animate the scroll (default true) */
  smooth?: boolean;
  /** Where the target lands inside the viewport (default 'center') */
  align?: "start" | "center";
}

/** Imperative API exposed through the ref */
export interface GanttHandle {
  /** Scroll horizontally to a given date */
  scrollToDate: (date: string | Date | Dayjs, options?: GanttScrollOptions) => void;
  /** Scroll horizontally to today */
  scrollToToday: (options?: GanttScrollOptions) => void;
  /** Scroll horizontally and vertically to a given task */
  scrollToTask: (taskId: string, options?: GanttScrollOptions) => void;
  /** The scroll container DOM node (null when unavailable) */
  getScrollElement: () => HTMLDivElement | null;
}

interface UseGanttScrollApiParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
  selectedScale: GanttScaleKey;
  rowHeight: number;
  /**
   * How much width the pinned task list on the left covers (default 0)
   *
   * The timeline starts that far to the right, so centering has to measure against the
   * narrowed viewport or the target lands behind the pane.
   */
  viewportInsetPx?: number;
}

/**
 * Imperative scroll API
 *
 * Dates outside the timeline and unknown task ids are ignored silently - so that
 * the common case of calling while data is still loading does not throw.
 */
export function useGanttScrollApi({
  scrollRef,
  bottomRowCells,
  transformedTasks,
  selectedScale,
  rowHeight,
  viewportInsetPx = 0,
}: UseGanttScrollApiParams): GanttHandle {
  const scrollToOffset = useCallback(
    (left: number, options?: GanttScrollOptions) => {
      const el = scrollRef.current;
      if (!el) return;

      // "start" needs no correction - at scrollLeft 0 the timeline origin already sits
      // just right of the pane
      const target =
        options?.align === "start"
          ? left
          : left - (el.clientWidth - viewportInsetPx) / 2;

      el.scrollTo({
        left: Math.max(0, target),
        behavior: options?.smooth === false ? "auto" : "smooth",
      });
    },
    [scrollRef, viewportInsetPx]
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

      // Vertical: move only when that row is outside the viewport (a visible row is left where it is)
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
            : task.barLeft +
              task.barWidth / 2 -
              (el.clientWidth - viewportInsetPx) / 2
        ),
        behavior: options?.smooth === false ? "auto" : "smooth",
      });
    },
    [transformedTasks, rowHeight, scrollRef, viewportInsetPx]
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
