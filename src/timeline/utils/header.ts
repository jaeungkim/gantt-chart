import { GanttBottomRowCell, GanttTopHeaderGroup } from 'shared/types';

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

// Where one tick cell ends and the next begins, in the same space as a bar's `barLeft`
export function tickBoundaries(cells: GanttBottomRowCell[]): number[] {
  const edges = [0];
  let x = 0;
  for (const cell of cells) {
    x += cell.widthPx;
    edges.push(x);
  }
  return edges;
}

// The cell `x` falls in: its index, left edge and width. `boundaries` is ascending, so this is
// one binary search - a chart at day scale can carry a few thousand cells. A value exactly on a
// boundary belongs to the cell that starts there (the tick marks the instant that cell begins),
// and a value off either end to the first or last cell. Null only for an empty ruler.
export function tickCellAt(
  boundaries: number[],
  x: number
): { index: number; left: number; width: number } | null {
  if (boundaries.length < 2) return null;
  let low = 0;
  let high = boundaries.length - 2;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (boundaries[mid] <= x) low = mid;
    else high = mid - 1;
  }
  return {
    index: low,
    left: boundaries[low],
    width: boundaries[low + 1] - boundaries[low],
  };
}
