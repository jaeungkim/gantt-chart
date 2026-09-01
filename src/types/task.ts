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
  /** Allows/blocks starting a dependency drag from this task - overrides both `readOnly` settings */
  allowLinkCreate?: boolean;
  /** Allows/blocks deleting a dependency this task owns - overrides both `readOnly` settings */
  allowLinkDelete?: boolean;
}

/**
 * Chart-wide interaction settings
 *
 * Every field is optional, and a task's own field of the same name wins over it.
 * With nothing set, every gesture is allowed except creating tasks, which needs an
 * `onTaskCreate` callback to go anywhere.
 */
export interface GanttInteractionConfig {
  readOnly?: boolean;
  allowLinkCreate?: boolean;
  allowLinkDelete?: boolean;
  allowTaskCreate?: boolean;
}

export interface ResolvedTaskInteraction {
  canCreateLink: boolean;
  canDeleteLink: boolean;
}

/** Kept at module scope so the default argument has a stable identity */
const NO_INTERACTION_CONFIG: GanttInteractionConfig = {};

/**
 * Resolves what one task allows, most specific setting first:
 *
 * `task.allowX` > `task.readOnly` > `config.allowX` > `config.readOnly` > allowed
 *
 * A capability flag always beats a blanket `readOnly` at the same level, so `readOnly`
 * on the chart plus `allowLinkDelete: true` on one task means "frozen except that
 * task's links".
 */
export function resolveTaskInteraction(
  task: Pick<Task, 'readOnly' | 'allowLinkCreate' | 'allowLinkDelete'>,
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
    canCreateLink: resolve(task.allowLinkCreate, config.allowLinkCreate),
    canDeleteLink: resolve(task.allowLinkDelete, config.allowLinkDelete),
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
