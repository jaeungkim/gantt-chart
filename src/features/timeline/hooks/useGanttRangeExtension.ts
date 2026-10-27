import { RefObject, useEffect, useState } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttBottomRowCell, GanttRangeExtension, GanttScaleKey } from "shared/types";
import { extendRangeForScroll, NO_RANGE_EXTENSION } from "features/timeline/utils/viewport";

interface UseGanttRangeExtensionParams {
  enabled: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  selectedScale: GanttScaleKey;
  bottomRowCells: GanttBottomRowCell[];
  totalWidth: number;
  viewportInsetPx: number;
  pinnedStart: boolean;
  pinnedEnd: boolean;
}

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
