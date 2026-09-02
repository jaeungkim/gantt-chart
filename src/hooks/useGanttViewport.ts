import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLatestRef } from "hooks/useLatestRef";
import { GanttScrollApi, GanttZoomAnchor } from "hooks/useGanttScrollApi";
import { useGanttStore } from "stores/context";
import {
  GanttBottomRowCell,
  GanttDateRange,
  GanttRangeExtension,
  GanttScaleKey,
  GanttVisibleRange,
} from "types/gantt";
import { Task } from "types/task";
import dayjs from "core/dates";
import {
  calculateDateOffsetPx,
  computeTimelineData,
  dateAtOffsetPx,
  originShiftPx,
  timelineRange,
} from "utils/timeline";
import {
  accumulateZoom,
  extendRangeForScroll,
  INITIAL_ZOOM_ACCUMULATOR,
  NO_RANGE_EXTENSION,
  stepScale,
} from "utils/viewport";

/**
 * The viewport: which slice of time is built, where it is scrolled, at what scale
 *
 * These hooks are separate because they run in a fixed order and feed each other -
 * the extension decides how wide the timeline is built, building it hands back a
 * `zoomTo`, and the wheel and reporting listeners are attached on top of that.
 */

interface UseGanttRangeExtensionParams {
  /** Off (the default `infiniteScroll`), the timeline never grows past its tasks */
  enabled: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedScale: GanttScaleKey;
  bottomRowCells: GanttBottomRowCell[];
  totalWidth: number;
  /** Width of the pinned task list, which the viewport does not extend into */
  viewportInsetPx: number;
  /** A pinned end is where the host put it - growing past it would be undone on every recompute */
  pinnedStart: boolean;
  pinnedEnd: boolean;
}

/**
 * How far past the tasks the timeline is currently built
 *
 * Counted in ticks, so the number only means anything at the scale it was measured
 * at - tagging it with that scale drops it on a scale change without an extra render.
 */
export function useGanttRangeExtension({
  enabled,
  scrollRef,
  selectedScale,
  bottomRowCells,
  totalWidth,
  viewportInsetPx,
  pinnedStart,
  pinnedEnd,
}: UseGanttRangeExtensionParams): GanttRangeExtension {
  const [extension, setExtension] = useState<{
    scale: GanttScaleKey;
    value: GanttRangeExtension;
  }>({ scale: selectedScale, value: NO_RANGE_EXTENSION });

  const active =
    extension.scale === selectedScale ? extension.value : NO_RANGE_EXTENSION;

  const scaleRef = useLatestRef(selectedScale);
  const cellsRef = useLatestRef(bottomRowCells);
  const totalWidthRef = useLatestRef(totalWidth);
  const insetRef = useLatestRef(viewportInsetPx);
  const activeRef = useLatestRef(active);

  // Re-subscribed whenever the cells change, which also re-checks the edges right after a
  // rebuild - that is what lets a drag keep pushing past the end
  useEffect(() => {
    if (!enabled) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const checkEdges = () => {
      const cells = cellsRef.current;
      const totalPx = totalWidthRef.current;
      if (!cells.length || totalPx <= 0) return;

      const next = extendRangeForScroll({
        current: activeRef.current,
        scrollLeft: scrollEl.scrollLeft,
        viewportPx: scrollEl.clientWidth - insetRef.current,
        totalPx,
        pxPerTick: totalPx / cells.length,
        canExtend: { before: !pinnedStart, after: !pinnedEnd },
      });
      if (!next) return;

      activeRef.current = next;
      setExtension({ scale: scaleRef.current, value: next });
    };

    checkEdges();
    scrollEl.addEventListener("scroll", checkEdges, { passive: true });
    return () => scrollEl.removeEventListener("scroll", checkEdges);
  }, [
    enabled,
    bottomRowCells,
    pinnedStart,
    pinnedEnd,
    scrollRef,
    cellsRef,
    totalWidthRef,
    activeRef,
    insetRef,
    scaleRef,
  ]);

  return active;
}

interface UseGanttTimelineSyncParams {
  rawTasks: Task[];
  selectedScale: GanttScaleKey;
  /** Pinned window, or undefined to fit the timeline to the tasks */
  visibleRange: GanttVisibleRange | undefined;
  hierarchy: boolean;
  extension: GanttRangeExtension;
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
}

/**
 * Builds the timeline whenever its inputs change, and keeps the view still while it does
 *
 * A rebuild can move the timeline's origin - dragging the earliest task changes
 * min(startDate), and every bar shifts with it. Two things compensate for that: the
 * origin shift measured against the previous cells, and a zoom anchor, which is the
 * more specific answer and wins when both exist.
 *
 * Returns the scale switch that keeps `anchor.date` under the cursor.
 */
export function useGanttTimelineSync({
  rawTasks,
  selectedScale,
  visibleRange,
  hierarchy,
  extension,
  scrollRef,
  bottomRowCells,
}: UseGanttTimelineSyncParams): (
  scale: GanttScaleKey,
  anchor: GanttZoomAnchor
) => void {
  const scaleRef = useLatestRef(selectedScale);
  const cellsRef = useLatestRef(bottomRowCells);

  const setBottomRowCells = useGanttStore((store) => store.setBottomRowCells);
  const setTransformedTasks = useGanttStore((store) => store.setTransformedTasks);
  const clearAllDragOffsets = useGanttStore((store) => store.clearAllDragOffsets);
  const setSelectedScale = useGanttStore((store) => store.setSelectedScale);

  // Cells of the previous timeline - used to compute how far the origin moved
  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);
  // Date to put back under the cursor once the new scale's cells exist
  const pendingAnchorRef = useRef<GanttZoomAnchor | null>(null);

  // Build the timeline structure (clears to an empty timeline when there are no tasks)
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      rawTasks,
      selectedScale,
      visibleRange,
      hierarchy,
      extension
    );

    // Only the compensation amount is recorded here - raising scrollLeft before the
    // content gets wider makes the browser clamp it to the maximum at that moment,
    // so the actual adjustment happens in the effect below.
    const prevCells = prevCellsRef.current;
    if (prevCells.length && bottomCells.length) {
      pendingScrollShiftRef.current += originShiftPx(
        prevCells,
        bottomCells,
        selectedScale
      );
    }
    prevCellsRef.current = bottomCells;

    setBottomRowCells(bottomCells);
    setTransformedTasks(transformedTasks);
    // Clear the drag offsets now that the new positions are ready - avoids a one-frame
    // flicker on drop
    clearAllDragOffsets();
  }, [
    rawTasks,
    selectedScale,
    visibleRange,
    hierarchy,
    extension,
    setBottomRowCells,
    setTransformedTasks,
    clearAllDragOffsets,
  ]);

  // Apply the compensation after the new timeline width has landed in the DOM
  // (deliberately keyed on the cells alone - the scale changes one commit earlier, and
  //  measuring against cells that do not belong to it would land in the wrong place)
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const anchor = pendingAnchorRef.current;

    // Both exist to keep the view still while the timeline is rebuilt, and the anchor
    // is the more specific answer
    if (anchor) {
      pendingAnchorRef.current = null;
      pendingScrollShiftRef.current = 0;

      const px = calculateDateOffsetPx(
        anchor.date,
        bottomRowCells,
        scaleRef.current
      );
      if (scrollEl && px !== null) {
        scrollEl.scrollLeft = Math.max(0, px - anchor.viewportX);
        return;
      }
    }

    const shift = pendingScrollShiftRef.current;
    if (!shift) return;

    pendingScrollShiftRef.current = 0;
    if (scrollEl) scrollEl.scrollLeft += shift;
  }, [bottomRowCells, scrollRef, scaleRef]);

  return useCallback(
    (scale: GanttScaleKey, anchor: GanttZoomAnchor) => {
      if (scale === scaleRef.current) {
        // Same scale - no rebuild is coming, so place the anchor now
        const scrollEl = scrollRef.current;
        const px = calculateDateOffsetPx(anchor.date, cellsRef.current, scale);
        if (scrollEl && px !== null) {
          scrollEl.scrollLeft = Math.max(0, px - anchor.viewportX);
        }
        return;
      }

      pendingAnchorRef.current = anchor;
      setSelectedScale(scale);
    },
    [setSelectedScale, scrollRef, scaleRef, cellsRef]
  );
}

interface UseGanttWheelZoomParams {
  /** Off (the default `zoomOnWheel`), ctrl/cmd + wheel is left to the browser */
  enabled: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedScale: GanttScaleKey;
  bottomRowCells: GanttBottomRowCell[];
  /** Width of the pinned task list, which the timeline's own left edge starts after */
  viewportInsetPx: number;
  zoomTo: (scale: GanttScaleKey, anchor: GanttZoomAnchor) => void;
}

/** Ctrl/Cmd + wheel steps through the scale ladder, keeping the date under the cursor */
export function useGanttWheelZoom({
  enabled,
  scrollRef,
  selectedScale,
  bottomRowCells,
  viewportInsetPx,
  zoomTo,
}: UseGanttWheelZoomParams): void {
  const scaleRef = useLatestRef(selectedScale);
  const cellsRef = useLatestRef(bottomRowCells);
  const insetRef = useLatestRef(viewportInsetPx);

  useEffect(() => {
    if (!enabled) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const accumulator = { ...INITIAL_ZOOM_ACCUMULATOR };

    const handleWheel = (event: WheelEvent) => {
      // Plain wheel still scrolls vertically and Shift+wheel horizontally
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const { state, step } = accumulateZoom(
        accumulator,
        event.deltaY,
        event.timeStamp
      );
      Object.assign(accumulator, state);
      if (!step) return;

      const nextScale = stepScale(scaleRef.current, step);
      if (nextScale === scaleRef.current) return;

      // Where the cursor is inside the timeline area. A cursor over the pinned task list
      // clamps to the timeline's own left edge, so zooming there is still anchored to
      // something the user can see.
      const rect = scrollEl.getBoundingClientRect();
      const inset = insetRef.current;
      const viewportX =
        Math.min(
          Math.max(event.clientX - rect.left, inset),
          scrollEl.clientWidth
        ) - inset;

      const date = dateAtOffsetPx(
        scrollEl.scrollLeft + viewportX,
        cellsRef.current,
        scaleRef.current
      );
      if (!date) return;

      zoomTo(nextScale, { date, viewportX });
    };

    // Registered by hand and non-passive - preventDefault has to stop the browser's own
    // ctrl+wheel page zoom, which a passive listener cannot do
    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", handleWheel);
  }, [enabled, zoomTo, scrollRef, scaleRef, cellsRef, insetRef]);
}

/** Reports the rendered timeline range - the hook a host lazy-loads tasks from */
export function useGanttRangeReport(
  bottomRowCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  onRangeChange?: (range: GanttDateRange) => void
): void {
  const scaleRef = useLatestRef(selectedScale);
  const reportRef = useLatestRef(onRangeChange);
  const reportedRef = useRef("");

  useEffect(() => {
    const report = reportRef.current;
    if (!report) return;

    const range = timelineRange(bottomRowCells, scaleRef.current);
    if (!range) return;

    // Fires on a real range change only - a re-render with the same dates is not one
    const key = `${range.start.valueOf()}:${range.end.valueOf()}`;
    if (key === reportedRef.current) return;

    reportedRef.current = key;
    report(range);
  }, [bottomRowCells, scaleRef, reportRef]);
}

/** Scrolls to `initialScrollTo` once, when the timeline first becomes ready */
export function useGanttInitialScroll(
  initialScrollTo: "today" | string | undefined,
  bottomRowCells: GanttBottomRowCell[],
  scrollApi: GanttScrollApi
): void {
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current || !initialScrollTo) return;
    if (!bottomRowCells.length) return;

    doneRef.current = true;
    const target = initialScrollTo === "today" ? dayjs() : initialScrollTo;
    scrollApi.scrollToDate(target, { smooth: false });
  }, [initialScrollTo, bottomRowCells, scrollApi]);
}
