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
  /**
   * Bar color - any CSS color value
   *
   * The progress fill and the hover shade are derived from it, so one value colors the
   * whole bar. Omitted, the `--gantt-*` theme tokens decide as before.
   */
  color?: string;
  /** Extra class name put on this task's bar and its task-list row */
  className?: string;
  dependencies?: TaskDependency[];
}

export function isMilestoneTask(task: Pick<Task, 'type'>): boolean {
  return task.type === 'milestone';
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
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
