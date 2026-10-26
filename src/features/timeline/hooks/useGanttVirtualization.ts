import { RefObject, useCallback, useMemo } from "react";
import { GanttBottomRowCell, GanttGeometry } from "shared/types";
import { fixedAxis } from "shared/virtual/axis";
import { useVirtualWindow } from "shared/virtual/useVirtualWindow";
import { virtualItemsOf, windowBounds } from "shared/virtual/window";
import { GanttVirtualization } from "features/timeline/types";
import { tickAxis } from "features/timeline/utils/tickAxis";

interface UseGanttVirtualizationParams {
  /** Number of rows in the chart - not the task count, since a lane can share one row */
  rowCount: number;
  bottomRowCells: GanttBottomRowCell[];
  scrollRef: RefObject<HTMLDivElement | null>;
  geometry: GanttGeometry;
}

// Call once at the top and hand the result down: header, rows, bars and arrows must cull
// against the same window or one ends up a frame ahead of another.
export function useGanttVirtualization({
  rowCount,
  bottomRowCells,
  scrollRef,
  geometry,
}: UseGanttVirtualizationParams): GanttVirtualization {
  const { rowHeight } = geometry;
  const rowAxis = useMemo(
    () => fixedAxis(rowCount, rowHeight),
    [rowCount, rowHeight]
  );

  const colAxis = useMemo(() => tickAxis(bottomRowCells), [bottomRowCells]);

  const { row, col, sync } = useVirtualWindow({
    scrollRef,
    row: rowAxis,
    col: colAxis,
  });

  const virtualRows = useMemo(
    () => virtualItemsOf(rowAxis, row),
    [rowAxis, row]
  );
  const virtualCells = useMemo(
    () => virtualItemsOf(colAxis, col),
    [colAxis, col]
  );

  const { startPx, endPx } = windowBounds(colAxis, col);
  const { startPx: rowStartPx, endPx: rowEndPx } = windowBounds(rowAxis, row);
  const isBarVisible = useCallback(
    (barLeft: number, barWidth: number) =>
      barLeft + barWidth >= startPx && barLeft <= endPx,
    [startPx, endPx]
  );

  return {
    virtualRows,
    totalHeight: rowAxis.total,
    virtualCells,
    totalWidth: colAxis.total,
    leadingCellPx: startPx,
    rowStartPx,
    rowEndPx,
    isBarVisible,
    syncWindow: sync,
  };
}
