export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  parentId: string | null;
  sequence: string;
  dependencies?: TaskDependency[];
}

export interface TaskDependency {
  targetId: string;
  type: DependencyType;
}

export enum DependencyType {
  FinishToStart = 'FS',
  StartToStart = 'SS',
  FinishToFinish = 'FF',
  StartToFinish = 'SF',
}

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
