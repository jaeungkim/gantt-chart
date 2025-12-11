import { GanttTopHeaderGroup } from 'types/gantt';

export interface HeaderGroupWithPosition extends GanttTopHeaderGroup {
  left: number;
}

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

/**
 * 그룹들에 왼쪽 위치(left) 값 추가
 * 스크롤 시 sticky 헤더 위치 계산에 사용
 */
export function addLeftPositions(
  groups: GanttTopHeaderGroup[]
): HeaderGroupWithPosition[] {
  let offset = 0;
  return groups.map((group) => {
    const groupWithLeft = { ...group, left: offset };
    offset += group.widthPx;
    return groupWithLeft;
  });
}

/**
 * 헤더 그룹을 병합하고 위치 정보 추가
 * mergeHeaderGroups와 addLeftPositions를 한 번에 수행
 */
export function processHeaderGroups(
  groups: GanttTopHeaderGroup[]
): HeaderGroupWithPosition[] {
  const merged = mergeHeaderGroups(groups);
  return addLeftPositions(merged);
}

