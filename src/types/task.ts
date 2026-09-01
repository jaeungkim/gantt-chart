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
  dependencies?: TaskDependency[];
}

export function isMilestoneTask(task: Pick<Task, 'type'>): boolean {
  return task.type === 'milestone';
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
