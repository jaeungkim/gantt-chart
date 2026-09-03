import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttScrollApi, GanttZoomAnchor } from "timeline/hooks/useGanttScrollApi";
import { useGanttStore } from "shared/context";
import {
  GanttBottomRowCell,
  GanttDateRange,
  GanttRangeExtension,
  GanttScaleKey,
  GanttVisibleRange,
} from "shared/types";
import { Task } from "shared/task";
import dayjs from "core/dates";
import {
  calculateDateOffsetPx,
  computeTimelineData,
  dateAtOffsetPx,
  originShiftPx,
  timelineRange,
} from "timeline/utils/geometry";
import {
  accumulateZoom,
  extendRangeForScroll,
  INITIAL_ZOOM_ACCUMULATOR,
  NO_RANGE_EXTENSION,
  stepScale,
} from "timeline/utils/viewport";

// These hooks run in a fixed order and feed each other: the extension sets how wide the
// timeline is built, building it returns `zoomTo`, the listeners attach on top of that.

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

// How far past the tasks the timeline is built, counted in ticks - tagged with the scale it
// was measured at so a scale change drops it without an extra render.
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

  // Re-subscribed on every cell change, so the edges are re-checked right after a rebuild -
  // that is what lets a drag keep pushing past the end
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

// Rebuilds the timeline and keeps the view still: a rebuild can move the origin (dragging the
// earliest task moves min(startDate)), compensated by the measured origin shift or, when both
// exist, the zoom anchor. Returns the scale switch that keeps `anchor.date` under the cursor.
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

  // Clears to an empty timeline when there are no tasks
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      rawTasks,
      selectedScale,
      visibleRange,
      hierarchy,
      extension
    );

    // Recorded, not applied: raising scrollLeft before the content widens gets clamped
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
    // The new positions are ready, so dropping the offsets now avoids a one-frame flicker
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

  // Compensate once the new width is in the DOM. Keyed on the cells alone: the scale changes
  // one commit earlier, and measuring against cells that predate it lands in the wrong place.
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const anchor = pendingAnchorRef.current;

    // The anchor is the more specific answer, so it beats the origin shift
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

      // Cursor x inside the timeline area; over the pinned task list it clamps to the left edge
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

    // Non-passive: preventDefault has to stop the browser's own ctrl+wheel page zoom
    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", handleWheel);
  }, [enabled, zoomTo, scrollRef, scaleRef, cellsRef, insetRef]);
}

// Reports a committed scale change once per change, whatever the source, by reading the settled
// store value. Seeded with the initial scale, so mount and a StrictMode remount stay silent.
export function useGanttScaleReport(
  selectedScale: GanttScaleKey,
  onScaleChange?: (scale: GanttScaleKey) => void
): void {
  const reportRef = useLatestRef(onScaleChange);
  const reportedRef = useRef(selectedScale);

  useEffect(() => {
    if (selectedScale === reportedRef.current) return;

    reportedRef.current = selectedScale;
    reportRef.current?.(selectedScale);
  }, [selectedScale, reportRef]);
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
