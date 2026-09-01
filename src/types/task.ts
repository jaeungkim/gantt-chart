export type TaskType = 'task' | 'milestone';

export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  parentId: string | null;
  sequence: string;
  /** 태스크 종류 - 'milestone'은 startDate 기준 다이아몬드로 렌더링 (기본 'task') */
  type?: TaskType;
  /** 진행률 0-100 (%) - 생략 시 진행률 표시 없음 */
  progress?: number;
  dependencies?: TaskDependency[];
}

export function isMilestoneTask(task: Pick<Task, 'type'>): boolean {
  return task.type === 'milestone';
}

/** 진행률을 0-100 범위로 정규화, 값이 없거나 유효하지 않으면 null */
export function normalizeProgress(progress: number | undefined): number | null {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.min(100, Math.max(0, progress));
}

export interface TaskDependency {
  targetId: string;
  type: DependencyType;
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export interface TaskTransformed extends Task {
  barLeft: number;
  barWidth: number;
  depth: number;
  order: number;
  originalOrder: number;
  dependencies?: TaskDependency[];
}

export interface RenderedDependency extends TaskDependency {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
