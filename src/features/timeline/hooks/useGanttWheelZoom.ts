import { RefObject, useEffect } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { dateAtOffsetPx } from "features/timeline/utils/geometry";
import { accumulateZoom, INITIAL_ZOOM_ACCUMULATOR, stepScale } from "features/timeline/utils/viewport";
import { GanttZoomAnchor } from "features/timeline/types";

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

    let accumulator = INITIAL_ZOOM_ACCUMULATOR;

    const handleWheel = (event: WheelEvent) => {
      // Plain wheel still scrolls vertically and Shift+wheel horizontally
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const { state, step } = accumulateZoom(
        accumulator,
        event.deltaY,
        event.timeStamp
      );
      accumulator = state;
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
