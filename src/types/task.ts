// The data model lives in the headless core; this module adds the render-side types.
export { isMilestoneTask, normalizeProgress } from 'core/types';
export type {
  DependencyType,
  Task,
  TaskDependency,
  TaskType,
} from 'core/types';

import type { Task, TaskDependency } from 'core/types';

export interface TaskTransformed extends Task {
  barLeft: number;
  barWidth: number;
  depth: number;
  order: number;
  originalOrder: number;
  /**
   * A summary row with children (true only when hierarchy is on)
   *
   * Its start/end are recomputed from the children, so resizing and progress editing are
   * disabled and dragging the bar moves the whole subtree.
   */
  isSummary?: boolean;
  dependencies?: TaskDependency[];
  /** Baseline bar geometry - present only when the task carries baseline dates */
  baselineLeft?: number;
  baselineWidth?: number;
  /** CPM outputs - present only while the `criticalPath` prop is on (read-only) */
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  totalSlack?: number;
  freeSlack?: number;
  critical?: boolean;
  /** Duration in calendar days, or working days when the working-day calendar is on */
  duration?: number;
}

export interface RenderedDependency extends TaskDependency {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** True when this link sits on the critical path */
  critical?: boolean;
}
