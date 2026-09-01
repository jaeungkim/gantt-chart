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
 * With nothing set, every gesture is allowed and there are no drag bounds - except
 * drawing new tasks, which needs an `onTaskCreate` callback to go anywhere.
 */
export interface GanttInteractionConfig {
  readOnly?: boolean;
  allowMove?: boolean;
  allowResize?: boolean;
  allowProgressChange?: boolean;
  allowLinkCreate?: boolean;
  allowLinkDelete?: boolean;
  allowTaskCreate?: boolean;
  minDate?: string;
  maxDate?: string;
}

export interface ResolvedTaskInteraction {
  canMove: boolean;
  canResize: boolean;
  canChangeProgress: boolean;
  canCreateLink: boolean;
  canDeleteLink: boolean;
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
    | 'allowLinkCreate'
    | 'allowLinkDelete'
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
    canCreateLink: resolve(task.allowLinkCreate, config.allowLinkCreate),
    canDeleteLink: resolve(task.allowLinkDelete, config.allowLinkDelete),
    minDate: task.minDate ?? config.minDate,
    maxDate: task.maxDate ?? config.maxDate,
  };
}

/**
 * Whether drawing a new task on empty timeline space is allowed
 * Chart-wide only - the gesture starts on a row, not on a task
 */
export function canCreateTasks(
  config: GanttInteractionConfig = NO_INTERACTION_CONFIG
): boolean {
  return config.allowTaskCreate ?? !config.readOnly;
}

/**
 * CSS custom properties a colored bar sets
 *
 * Every value is a fallback for a theme token, so an empty object means the CSS
 * defaults keep deciding - a task without a color renders exactly as before.
 */
export interface TaskColorVars {
  '--gantt-bar-color'?: string;
  '--gantt-bar-color-hover'?: string;
  '--gantt-progress-color'?: string;
}

/**
 * Resolves a task's color into the variables the stylesheet reads
 *
 * Precedence: the task's own `color` wins; a missing or blank one resolves to nothing,
 * which leaves `--gantt-bar-bg` / `--gantt-progress-bg` (and any host override of them)
 * in charge. The progress fill and the hover shade are always derived from the bar color
 * rather than read from a token, so a colored bar never mixes in the theme gray.
 */
export function resolveTaskColors(color: string | undefined): TaskColorVars {
  const base = color?.trim();
  if (!base) return {};

  return {
    '--gantt-bar-color': base,
    '--gantt-bar-color-hover': `color-mix(in srgb, ${base} 86%, #000)`,
    '--gantt-progress-color': `color-mix(in srgb, ${base} 62%, #000)`,
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
  /** Id of the successor that owns this dependency (`targetId` is the predecessor) */
  sourceId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** True when this link sits on the critical path */
  critical?: boolean;
}
