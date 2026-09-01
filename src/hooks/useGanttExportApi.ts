import { RefObject, useCallback, useMemo } from "react";
import { useGanttStoreApi } from "stores/context";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import {
  captureScrollContainer,
  GanttExportOptions,
  nextFrame,
  resolveExportRangePx,
} from "utils/pngExport";

/** Imperative export API */
export interface GanttExportApi {
  /**
   * Renders the whole chart to a PNG and resolves with the blob
   *
   * No download is triggered - what to do with the blob is the caller's choice
   * (save it, upload it, drop it into a PDF).
   */
  exportToPng: (options?: GanttExportOptions) => Promise<Blob>;
}

interface UseGanttExportApiParams {
  scrollRef: RefObject<HTMLDivElement | null>;
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  taskCount: number;
  totalWidth: number;
}

/** Default output density - 2 keeps text crisp on a retina screen and in print */
const DEFAULT_PIXEL_RATIO = 2;

/** Frames the un-virtualized render is given before the capture gives up */
const MAX_RENDER_FRAMES = 60;

/**
 * Waits until every row has actually landed in the DOM
 *
 * Flipping `exportMode` only schedules a React update; how many frames the
 * un-virtualized render takes depends on the task count, so the DOM is polled
 * rather than a fixed number of frames guessed at.
 */
async function waitForFullRender(
  scrollEl: HTMLElement,
  expectedRows: number
): Promise<void> {
  for (let frame = 0; frame < MAX_RENDER_FRAMES; frame++) {
    await nextFrame();
    if (scrollEl.querySelectorAll(".gantt-task-row").length >= expectedRows) {
      return;
    }
  }

  throw new Error(
    `exportToPng: timed out waiting for all ${expectedRows} rows to render.`
  );
}

/** Theme background, falling back to white when the host has made the container transparent */
function resolveBackground(container: HTMLElement): string {
  const background = window.getComputedStyle(container).backgroundColor;
  const isTransparent =
    !background ||
    background === "transparent" ||
    background === "rgba(0, 0, 0, 0)";

  return isTransparent ? "#ffffff" : background;
}

/**
 * Imperative PNG export
 *
 * Rows, arrows and header cells are all virtualized, so the live DOM only ever
 * holds the visible slice. The export turns virtualization off, waits for the
 * full chart to render, captures it, and puts the chart back exactly as it was
 * - scroll position included - whether the capture succeeded or threw.
 */
export function useGanttExportApi({
  scrollRef,
  bottomRowCells,
  selectedScale,
  taskCount,
  totalWidth,
}: UseGanttExportApiParams): GanttExportApi {
  const storeApi = useGanttStoreApi();

  const exportToPng = useCallback(
    async (options?: GanttExportOptions): Promise<Blob> => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) {
        throw new Error("exportToPng: no Gantt chart is mounted.");
      }

      const container = scrollEl.closest<HTMLElement>(".gantt-container");
      if (!container) {
        throw new Error("exportToPng: the chart container is not in the DOM.");
      }

      if (!bottomRowCells.length || totalWidth < 1) {
        throw new Error(
          "exportToPng: the chart has no timeline to export (no tasks)."
        );
      }

      // Resolved before export mode is entered, so a bad range fails without
      // disturbing the chart
      const { left, width } = resolveExportRangePx(
        options?.range,
        bottomRowCells,
        selectedScale,
        totalWidth
      );
      const background = options?.background ?? resolveBackground(container);

      const { scrollLeft, scrollTop } = scrollEl;
      storeApi.getState().setExportMode(true);

      try {
        await waitForFullRender(scrollEl, taskCount);

        return await captureScrollContainer(scrollEl, {
          left,
          width,
          background,
          pixelRatio: options?.pixelRatio ?? DEFAULT_PIXEL_RATIO,
        });
      } finally {
        storeApi.getState().setExportMode(false);
        // The full render is still in the DOM at this point, so the offsets
        // still exist to be restored
        scrollEl.scrollLeft = scrollLeft;
        scrollEl.scrollTop = scrollTop;
      }
    },
    [scrollRef, bottomRowCells, selectedScale, taskCount, totalWidth, storeApi]
  );

  return useMemo(() => ({ exportToPng }), [exportToPng]);
}
