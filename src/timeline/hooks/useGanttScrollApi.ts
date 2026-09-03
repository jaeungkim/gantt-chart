import { Dayjs } from "dayjs";
import { RefObject, useCallback, useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import { calculateDateOffsetPx, dateAtOffsetPx } from "timeline/utils/geometry";
import { fitScale } from "timeline/utils/viewport";
import { GANTT_SCALE_CONFIG } from "shared/constants";

/** Options for the scrollTo* methods */
export interface GanttScrollOptions {
  /** Whether to animate the scroll (default true) */
  smooth?: boolean;
  /** Where the target lands inside the viewport (default 'center') */
  align?: "start" | "center";
}

/** A date pinned at a fixed distance from the timeline's visible left edge */
export interface GanttZoomAnchor {
  date: Dayjs;
  /** px from the left edge of the timeline area (the task list pane excluded) */
  viewportX: number;
}

/** Imperative scroll and zoom API */
export interface GanttScrollApi {
  /** Scroll horizontally to a given date */
  scrollToDate: (date: string | Date | Dayjs, options?: GanttScrollOptions) => void;
  /** Scroll horizontally to today */
  scrollToToday: (options?: GanttScrollOptions) => void;
  /** Scroll horizontally and vertically to a given task */
  scrollToTask: (taskId: string, options?: GanttScrollOptions) => void;
  /** Switches the scale, keeping the centre date centred; an unknown key is ignored */
  setScale: (scale: GanttScaleKey) => void;
  /** Switches to the finest scale the whole project fits at and scrolls it into view (no-op with no tasks) */
  zoomToFit: () => void;
  /** The scroll container DOM node (null when unavailable) */
  getScrollElement: () => HTMLDivElement | null;
}

/** Opening and closing the detail panel from outside the chart */
export interface GanttDetailApi {
  /** Opens the detail panel on a task; unknown ids and a panel-less chart (no `renderDetail`/`showDetail`) are ignored */
  openDetail: (taskId: string) => void;
  /** Closes the detail panel */
  closeDetail: () => void;
}

/** Proposing a new task from outside the chart */
export interface GanttTaskCreateApi {
  /** Sends a one-tick draft at today to `onTaskCreate`, as the "Add task" button does; no-op without `onTaskCreate` or with `allowTaskCreate` false */
  addTask: () => void;
}

/** Imperative API exposed through the ref */
export interface GanttHandle
  extends GanttScrollApi,
    GanttDetailApi,
    GanttTaskCreateApi {}

interface UseGanttScrollApiParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
  selectedScale: GanttScaleKey;
  rowHeight: number;
  /** Width of the pinned task list (default 0) - centering measures against the narrowed viewport */
  viewportInsetPx?: number;
  /** Switches scale while keeping the anchor date where it is on screen */
  zoomTo: (scale: GanttScaleKey, anchor: GanttZoomAnchor) => void;
  /** Sets the scale with no anchor - the fallback when there is nothing on screen to pin */
  setSelectedScale: (scale: GanttScaleKey) => void;
}

// Dates outside the timeline and unknown task ids are ignored silently, so calling while
// data is still loading does not throw.
export function useGanttScrollApi({
  scrollRef,
  bottomRowCells,
  transformedTasks,
  selectedScale,
  rowHeight,
  viewportInsetPx = 0,
  zoomTo,
  setSelectedScale,
}: UseGanttScrollApiParams): GanttScrollApi {
  const scrollToOffset = useCallback(
    (left: number, options?: GanttScrollOptions) => {
      const el = scrollRef.current;
      if (!el) return;

      // "start" needs no correction: at scrollLeft 0 the origin already sits right of the pane
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

      // Vertical: move only when the row is off screen. `order` is the row number, so
      // shared lanes are accounted for.
      const rowTop = (task.order - 1) * rowHeight;
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

  const setScale = useCallback(
    (scale: GanttScaleKey) => {
      // A JS caller can hand in anything, and an unknown key throws further down
      if (!(scale in GANTT_SCALE_CONFIG)) return;

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

    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const task of transformedTasks) {
      minTime = Math.min(minTime, dayjs(task.startDate).valueOf());
      maxTime = Math.max(maxTime, dayjs(task.endDate).valueOf());
    }
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return;

    // First moment pinned to the left edge, at the scale the whole span fits that width
    zoomTo(fitScale(maxTime - minTime, el.clientWidth - viewportInsetPx), {
      date: dayjs(minTime),
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
