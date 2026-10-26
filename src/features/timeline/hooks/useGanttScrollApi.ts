import { Dayjs } from "dayjs";
import { RefObject, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { GanttBottomRowCell, GanttGeometry, GanttScaleKey } from "shared/types";
import { TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import {
  calculateDateOffsetPx,
  dateAtOffsetPx,
  findDateRangeFromTasks,
} from "features/timeline/utils/geometry";
import { fitScale } from "features/timeline/utils/viewport";
import { GanttScrollApi, GanttScrollOptions, GanttZoomAnchor } from "features/timeline/types";
import { GANTT_SCALE_CONFIG, HEADER_HEIGHT } from "shared/constants";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import { useLatestRef } from "shared/hooks/useLatestRef";

interface UseGanttScrollApiParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
  selectedScale: GanttScaleKey;
  /** Width of the pinned task list - centering measures against the narrowed viewport */
  viewportInsetPx: number;
  /** Switches scale and puts `anchor.date` at `anchor.viewportX` */
  zoomTo: (scale: GanttScaleKey, anchor: GanttZoomAnchor) => void;
  geometry: GanttGeometry;
}

type ScrollCall = (
  scroll: Pick<GanttScrollApi, "scrollToDate" | "scrollToTask">
) => void;

// An explicit "smooth" overrides the stylesheet's reduced-motion rule, so honour it here
export function scrollBehavior(options?: GanttScrollOptions): ScrollBehavior {
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return options?.smooth === false || reduceMotion ? "auto" : "smooth";
}

// Dates outside the timeline and unknown task ids are ignored silently, so calling while
// data is still loading does not throw.
export function useGanttScrollApi({
  scrollRef,
  bottomRowCells,
  transformedTasks,
  selectedScale,
  viewportInsetPx,
  zoomTo,
  geometry,
}: UseGanttScrollApiParams): GanttScrollApi {
  const { rowHeight } = geometry;
  const storeApi = useGanttStoreApi();
  const setSelectedScale = useGanttStore((store) => store.setSelectedScale);

  const scrollToDateNow = useCallback(
    (date: string | Date | Dayjs, options?: GanttScrollOptions) => {
      const el = scrollRef.current;
      const px = calculateDateOffsetPx(dayjs(date), bottomRowCells, selectedScale);
      if (!el || px === null) return;

      // "start" needs no correction: at scrollLeft 0 the origin already sits right of the pane
      const target =
        options?.align === "start"
          ? px
          : px - (el.clientWidth - viewportInsetPx) / 2;

      el.scrollTo({
        left: Math.max(0, target),
        behavior: scrollBehavior(options),
      });
    },
    [scrollRef, bottomRowCells, selectedScale, viewportInsetPx]
  );

  const scrollToTaskNow = useCallback(
    (taskId: string, options?: GanttScrollOptions) => {
      const task = transformedTasks.find((candidate) => candidate.id === taskId);
      if (!task) return;

      const el = scrollRef.current;
      if (!el) return;

      // Vertical: move only when the row is off screen. `order` is the row number, so
      // shared lanes are accounted for.
      const rowTop = (task.order - 1) * rowHeight;
      // The sticky header covers the top of the scroll box
      const visibleHeight = el.clientHeight - HEADER_HEIGHT;
      const outOfView =
        rowTop < el.scrollTop ||
        rowTop + rowHeight > el.scrollTop + visibleHeight;

      el.scrollTo({
        top: outOfView
          ? Math.max(0, rowTop - visibleHeight / 2 + rowHeight / 2)
          : el.scrollTop,
        left: Math.max(
          0,
          options?.align === "start"
            ? task.barLeft
            : task.barLeft +
              task.barWidth / 2 -
              (el.clientWidth - viewportInsetPx) / 2
        ),
        behavior: scrollBehavior(options),
      });
    },
    [transformedTasks, scrollRef, viewportInsetPx, rowHeight]
  );

  const scrollNow = useMemo(
    () => ({ scrollToDate: scrollToDateNow, scrollToTask: scrollToTaskNow }),
    [scrollToDateNow, scrollToTaskNow]
  );

  // The last committed render, so a handle kept across renders still compares against it
  const renderedRef = useLatestRef({ selectedScale, bottomRowCells, scrollNow });

  // A scale change re-renders after the call that made it; until then cells and rows are stale
  const isCurrent = useCallback(() => {
    const state = storeApi.getState();
    return (
      state.selectedScale === renderedRef.current.selectedScale &&
      state.bottomRowCells === renderedRef.current.bottomRowCells
    );
  }, [storeApi, renderedRef]);

  // This tick's scroll calls, replayed once a scale change from the same tick has rendered
  const callsRef = useRef<ScrollCall[]>([]);

  const request = useCallback(
    (call: ScrollCall) => {
      if (isCurrent()) call(renderedRef.current.scrollNow);
      if (callsRef.current.push(call) > 1) return;

      queueMicrotask(() => {
        if (isCurrent()) callsRef.current = [];
      });
    },
    [isCurrent, renderedRef]
  );

  useLayoutEffect(() => {
    const calls = callsRef.current;
    if (!calls.length || !isCurrent()) return;

    callsRef.current = [];
    calls.forEach((call) => call(scrollNow));
  }, [isCurrent, scrollNow]);

  const scrollToDate = useCallback(
    (date: string | Date | Dayjs, options?: GanttScrollOptions) =>
      request((scroll) => scroll.scrollToDate(date, options)),
    [request]
  );

  const scrollToToday = useCallback(
    (options?: GanttScrollOptions) => scrollToDate(dayjs(), options),
    [scrollToDate]
  );

  const scrollToTask = useCallback(
    (taskId: string, options?: GanttScrollOptions) =>
      request((scroll) => scroll.scrollToTask(taskId, options)),
    [request]
  );

  const setScale = useCallback(
    (scale: GanttScaleKey) => {
      // A JS caller can hand in anything, and an unknown key throws further down
      if (!Object.prototype.hasOwnProperty.call(GANTT_SCALE_CONFIG, scale)) return;

      const el = scrollRef.current;
      const viewportX = el
        ? Math.max(0, el.clientWidth - viewportInsetPx) / 2
        : 0;
      const date = el
        ? dateAtOffsetPx(el.scrollLeft + viewportX, bottomRowCells, selectedScale)
        : null;

      // Nothing on screen to anchor to - switch without one rather than invent a date
      if (!date) {
        setSelectedScale(scale);
        return;
      }
      zoomTo(scale, { date, viewportX });
    },
    [
      scrollRef,
      viewportInsetPx,
      bottomRowCells,
      selectedScale,
      setSelectedScale,
      zoomTo,
    ]
  );

  const zoomToFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !transformedTasks.length) return;

    const { minDate, maxDate } = findDateRangeFromTasks(transformedTasks);
    if (!minDate.isValid() || !maxDate.isValid()) return;

    // First moment pinned to the left edge, at the scale the whole span fits that width
    zoomTo(fitScale(maxDate.diff(minDate), el.clientWidth - viewportInsetPx), {
      date: minDate,
      viewportX: 0,
    });
  }, [transformedTasks, scrollRef, viewportInsetPx, zoomTo]);

  return useMemo(
    () => ({
      scrollToDate,
      scrollToToday,
      scrollToTask,
      setScale,
      zoomToFit,
      getScrollElement: () => scrollRef.current,
    }),
    [scrollToDate, scrollToToday, scrollToTask, setScale, zoomToFit, scrollRef]
  );
}
