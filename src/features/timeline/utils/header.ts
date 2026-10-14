import { GanttBottomRowCell, GanttTopHeaderGroup } from 'shared/types';
import { variableAxis, type VirtualAxis } from 'shared/virtual/axis';

// Merges consecutive groups carrying the same label into one wider group
export function mergeHeaderGroups(
  groups: GanttTopHeaderGroup[]
): GanttTopHeaderGroup[] {
  const merged: GanttTopHeaderGroup[] = [];

  for (const group of groups) {
    const last = merged[merged.length - 1];
    if (last && last.label === group.label) {
      last.widthPx += group.widthPx;
    } else {
      merged.push({ ...group });
    }
  }

  return merged;
}

// The tick cells as a measured axis, in the same space as a bar's `barLeft`
export function tickAxis(cells: GanttBottomRowCell[]): VirtualAxis {
  return variableAxis(cells.length, (index) => cells[index].widthPx);
}

// The cell `x` falls in: its index, left edge and width. A value exactly on a boundary belongs to
// the cell that starts there (the tick marks the instant that cell begins), and a value off either
// end to the first or last cell. Null only for an empty ruler.
export function tickCellAt(
  axis: VirtualAxis,
  x: number
): { index: number; left: number; width: number } | null {
  if (!axis.count) return null;

  const index = axis.indexAt(x);
  return { index, left: axis.offsetAt(index), width: axis.sizeAt(index) };
}
