import { GanttBottomRowCell } from 'shared/types';
import { variableAxis, type VirtualAxis } from 'shared/virtual/axis';

export function tickAxis(cells: GanttBottomRowCell[]): VirtualAxis {
  return variableAxis(cells.length, (index) => cells[index].widthPx);
}

export function tickCellAt(
  axis: VirtualAxis,
  x: number
): { index: number; left: number; width: number } | null {
  if (!axis.count) return null;

  const index = axis.indexAt(x);
  return { index, left: axis.offsetAt(index), width: axis.sizeAt(index) };
}
