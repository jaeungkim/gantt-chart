import { RefObject, useCallback, useMemo } from "react";
import { NODE_HEIGHT } from "shared/constants";
import { GanttBottomRowCell } from "shared/types";
import { fixedAxis, variableAxis } from "shared/virtual/axis";
import { useVirtualWindow } from "shared/virtual/useVirtualWindow";
import { virtualItemsOf, windowBounds } from "shared/virtual/window";
import type { VirtualItem } from "shared/virtual/window";

interface UseGanttVirtualizationParams {
  /** Number of rows on screen - not the task count, since a lane can share one row */
  rowCount: number;
  bottomRowCells: GanttBottomRowCell[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

export interface GanttVirtualization {
  /** Rows to render, already positioned */
  virtualRows: VirtualItem[];
  /** Height of all rows, culled ones included - the scrollable content height */
  totalHeight: number;
  /** Time cells to render, already positioned */
  virtualCells: VirtualItem[];
  /** Width of all cells, culled ones included - the scrollable content width */
  totalWidth: number;
  /** Width of the cells skipped before the first rendered one (px) */
  leadingCellPx: number;
  /** Vertical bounds of the row window (px) - what the arrows cull against */
  rowStartPx: number;
  rowEndPx: number;
  /** Horizontal culling, shared by the header, the bars and the arrows */
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
  scrollToRow: (index: number) => void;
}

// Call once at the top and hand the result down: header, rows, bars and arrows must cull
// against the same window or one ends up a frame ahead of another.
export function useGanttVirtualization({
  rowCount,
  bottomRowCells,
  scrollRef,
}: UseGanttVirtualizationParams): GanttVirtualization {
  const rowAxis = useMemo(() => fixedAxis(rowCount, NODE_HEIGHT), [rowCount]);

  const colAxis = useMemo(
    () => variableAxis(bottomRowCells.length, (i) => bottomRowCells[i].widthPx),
    [bottomRowCells]
  );

  const { row, col, scrollToRow } = useVirtualWindow({
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
    scrollToRow,
  };
}
