import { RefObject, useEffect, useState } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttBottomRowCell, GanttRangeExtension, GanttScaleKey } from "shared/types";
import { extendRangeForScroll, NO_RANGE_EXTENSION } from "features/timeline/utils/viewport";

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
