import { GanttTopHeaderGroup } from 'types/gantt';

/**
 * Merges consecutive groups that carry the same label
 * Consecutive cells in the same month/year and so on become a single group
 */
export function mergeHeaderGroups(
  groups: GanttTopHeaderGroup[]
): GanttTopHeaderGroup[] {
  const merged: GanttTopHeaderGroup[] = [];

  for (const group of groups) {
    const last = merged[merged.length - 1];
    if (last && last.label === group.label) {
      // Add the width to the existing group
      last.widthPx += group.widthPx;
    } else {
      // Start a new group
      merged.push({ ...group });
    }
  }

  return merged;
}
