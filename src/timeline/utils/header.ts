import { GanttTopHeaderGroup } from 'shared/types';

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
