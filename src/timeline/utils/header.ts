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

// Largest boundary at or before `x`, and smallest at or after it. `boundaries` is ascending, so
// both are one binary search - a chart at day scale can carry a few thousand cells.
export function snapDown(boundaries: number[], x: number): number {
  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (boundaries[mid] <= x) low = mid;
    else high = mid - 1;
  }
  return boundaries[low];
}

export function snapUp(boundaries: number[], x: number): number {
  let low = 0;
  let high = boundaries.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (boundaries[mid] >= x) high = mid;
    else low = mid + 1;
  }
  return boundaries[high];
}
