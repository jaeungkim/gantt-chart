import { RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { useGanttStore } from "shared/context";
import { GanttBottomRowCell, GanttRangeExtension, GanttScaleKey, GanttVisibleRange } from "shared/types";
import { Task } from "shared/task";
import { calculateDateOffsetPx, computeTimelineData, originShiftPx } from "features/timeline/utils/geometry";
import { GanttZoomAnchor } from "features/timeline/types";

interface UseGanttTimelineSyncParams {
  rawTasks: Task[];
  selectedScale: GanttScaleKey;
  /** Pinned window, or undefined to fit the timeline to the tasks */
  visibleRange: GanttVisibleRange | undefined;
  hierarchy: boolean;
  extension: GanttRangeExtension;
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  syncWindow: () => void;
}

// Rebuilds the timeline and keeps the view still: a rebuild can move the origin (dragging the
// earliest task moves min(startDate)), compensated by the measured origin shift or the zoom
// anchor. Returns the scale switch that puts `anchor.date` at `anchor.viewportX`.
export function useGanttTimelineSync({
  rawTasks,
  selectedScale,
  visibleRange,
  hierarchy,
  extension,
  scrollRef,
  bottomRowCells,
  syncWindow,
}: UseGanttTimelineSyncParams): (
  scale: GanttScaleKey,
  anchor: GanttZoomAnchor
) => void {
  const scaleRef = useLatestRef(selectedScale);
  const cellsRef = useLatestRef(bottomRowCells);
  const syncWindowRef = useLatestRef(syncWindow);

  const setBottomRowCells = useGanttStore((store) => store.setBottomRowCells);
  const setTransformedTasks = useGanttStore((store) => store.setTransformedTasks);
  const clearAllDragOffsets = useGanttStore((store) => store.clearAllDragOffsets);
  const setSelectedScale = useGanttStore((store) => store.setSelectedScale);

  // Cells of the previous timeline - used to compute how far the origin moved
  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);
  // Anchor to place once the new scale's cells exist
  const pendingAnchorRef = useRef<GanttZoomAnchor | null>(null);

  // Clears to an empty timeline when there are no tasks, unless `visibleRange` pins both ends
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      rawTasks,
      selectedScale,
      visibleRange,
      hierarchy,
      extension
    );

    // Recorded, not applied: raising scrollLeft before the content widens gets clamped
    pendingScrollShiftRef.current += originShiftPx(
      prevCellsRef.current,
      bottomCells,
      selectedScale
    );
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
        // The window synced earlier in this pass read the old scroll; re-sync before paint
        syncWindowRef.current();
        return;
      }
    }

    const shift = pendingScrollShiftRef.current;
    if (!shift) return;

    pendingScrollShiftRef.current = 0;
    if (!scrollEl) return;
    scrollEl.scrollLeft += shift;
    syncWindowRef.current();
  }, [bottomRowCells, scrollRef, scaleRef, syncWindowRef]);

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
