export type TaskType = 'task' | 'milestone';

export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  parentId: string | null;
  sequence: string;
  /** Task kind - 'milestone' renders as a diamond at startDate (default 'task') */
  type?: TaskType;
  /** Progress 0-100 (%) - omitted means no progress display */
  progress?: number;
  dependencies?: TaskDependency[];
  /** Blocks every gesture on this task - overrides the chart's `readOnly` prop */
  readOnly?: boolean;
  /** Allows/blocks moving this task - overrides both `readOnly` settings */
  allowMove?: boolean;
  /** Allows/blocks resizing this task - overrides both `readOnly` settings */
  allowResize?: boolean;
  /** Allows/blocks dragging this task's progress handle - overrides both `readOnly` settings */
  allowProgressChange?: boolean;
  /** Earliest date this task may be dragged to (ISO string) - overrides the chart's `minDate` */
  minDate?: string;
  /** Latest date this task may be dragged to (ISO string) - overrides the chart's `maxDate` */
  maxDate?: string;
}

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
 * "frozen except that one progress bar". Milestones are never resizable.
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
  >,
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

  return {
    canMove: resolve(task.allowMove, config.allowMove),
    canResize:
      !isMilestoneTask(task) && resolve(task.allowResize, config.allowResize),
    canChangeProgress: resolve(
      task.allowProgressChange,
      config.allowProgressChange
    ),
    minDate: task.minDate ?? config.minDate,
    maxDate: task.maxDate ?? config.maxDate,
  };
}

export function isMilestoneTask(task: Pick<Task, 'type'>): boolean {
  return task.type === 'milestone';
}

/** Normalizes progress into the 0-100 range; null when the value is missing or invalid */
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
