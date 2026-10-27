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
  visibleRange: GanttVisibleRange | undefined;
  hierarchy: boolean;
  extension: GanttRangeExtension;
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  syncWindow: () => void;
}

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

  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);
  const pendingAnchorRef = useRef<GanttZoomAnchor | null>(null);

  useLayoutEffect(() => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      rawTasks,
      selectedScale,
      visibleRange,
      hierarchy,
      extension
    );

    pendingScrollShiftRef.current += originShiftPx(
      prevCellsRef.current,
      bottomCells,
      selectedScale
    );
    prevCellsRef.current = bottomCells;

    setBottomRowCells(bottomCells);
    setTransformedTasks(transformedTasks);
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

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const anchor = pendingAnchorRef.current;

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
