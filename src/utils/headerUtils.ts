import { GanttTopHeaderGroup } from 'types/gantt';

/**
 * 동일한 라벨을 가진 연속된 그룹들을 병합
 * 같은 월/년도 등의 연속된 셀들을 하나의 그룹으로 합침
 */
export function mergeHeaderGroups(
  groups: GanttTopHeaderGroup[]
): GanttTopHeaderGroup[] {
  const merged: GanttTopHeaderGroup[] = [];

  for (const group of groups) {
    const last = merged[merged.length - 1];
    if (last && last.label === group.label) {
      // 기존 그룹에 너비 추가
      last.widthPx += group.widthPx;
    } else {
      // 새 그룹 시작
      merged.push({ ...group });
    }
  }

  return merged;
}
