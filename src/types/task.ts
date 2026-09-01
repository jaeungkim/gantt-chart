// The data model lives in the headless core; this module adds the render-side types.
export { isMilestoneTask, normalizeProgress } from 'core/types';
export type {
  DependencyType,
  Task,
  TaskDependency,
  TaskType,
} from 'core/types';

import { isMilestoneTask } from 'core/types';
import type { Task, TaskDependency } from 'core/types';

/**
 * Chart-wide interaction settings
 *
 * Every field is optional, and a task's own field of the same name wins over it.
 * With nothing set, all three gestures are allowed and there are no drag bounds.
 */
export interface GanttInteractionConfig {
  readOnly?: boolean;
  allowMove?: boolean;
  allowResize?: boolean;
  allowProgressChange?: boolean;
  minDate?: string;
  maxDate?: string;
}

export interface ResolvedTaskInteraction {
  canMove: boolean;
  canResize: boolean;
  canChangeProgress: boolean;
  minDate?: string;
  maxDate?: string;
}

/** Kept at module scope so the default argument has a stable identity */
const NO_INTERACTION_CONFIG: GanttInteractionConfig = {};

/**
 * Resolves what one task allows, most specific setting first:
 *
 * `task.allowX` > `task.readOnly` > `config.allowX` > `config.readOnly` > allowed
 *
 * A capability flag always beats a blanket `readOnly` at the same level, so
 * `readOnly` on the chart plus `allowProgressChange: true` on one task means
 * "frozen except that one progress bar".
 *
 * Two structural rules are not flags and cannot be flagged back on, because the
 * gesture has nowhere to write to: milestones are never resizable (they are a
 * single point), and summary rows are never resizable and have no draggable
 * progress (both are rolled up from their children, so an edit would snap back).
 * Moving a summary is fine - it carries its whole subtree.
 */
export function resolveTaskInteraction(
  task: Pick<
    Task,
    | 'type'
    | 'readOnly'
    | 'allowMove'
    | 'allowResize'
    | 'allowProgressChange'
    | 'minDate'
    | 'maxDate'
  > & { isSummary?: boolean },
  config: GanttInteractionConfig = NO_INTERACTION_CONFIG
): ResolvedTaskInteraction {
  const resolve = (
    taskFlag: boolean | undefined,
    configFlag: boolean | undefined
  ): boolean => {
    if (taskFlag !== undefined) return taskFlag;
    if (task.readOnly !== undefined) return !task.readOnly;
    if (configFlag !== undefined) return configFlag;
    return !config.readOnly;
  };

  const derived = task.isSummary === true;

  return {
    canMove: resolve(task.allowMove, config.allowMove),
    canResize:
      !isMilestoneTask(task) &&
      !derived &&
      resolve(task.allowResize, config.allowResize),
    canChangeProgress:
      !derived &&
      resolve(task.allowProgressChange, config.allowProgressChange),
    minDate: task.minDate ?? config.minDate,
    maxDate: task.maxDate ?? config.maxDate,
  };
}

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
