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
  /** Allows/blocks starting a dependency drag from this task - overrides both `readOnly` settings */
  allowLinkCreate?: boolean;
  /** Allows/blocks deleting a dependency this task owns - overrides both `readOnly` settings */
  allowLinkDelete?: boolean;
  /** Earliest date this task may be dragged to (ISO string) - overrides the chart's `minDate` */
  minDate?: string;
  /** Latest date this task may be dragged to (ISO string) - overrides the chart's `maxDate` */
  maxDate?: string;
}

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
  /**
   * A summary row with children (true only when hierarchy is on)
   *
   * Its start/end are recomputed from the children, so resizing and progress editing are
   * disabled and dragging the bar moves the whole subtree.
   */
  isSummary?: boolean;
  dependencies?: TaskDependency[];
}

export interface RenderedDependency extends TaskDependency {
  /** Id of the successor that owns this dependency (`targetId` is the predecessor) */
  sourceId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
