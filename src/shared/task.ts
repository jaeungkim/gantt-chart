// The data model lives in the headless core; this module adds the render-side types.
export { normalizeProgress } from 'core/types';
export type {
  DependencyType,
  Task,
  TaskDependency,
} from 'core/types';

import type { Task, TaskDependency } from 'core/types';

/** Chart-wide interaction settings - every gesture is allowed by default (task creation also needs `onTaskCreate`), and a task's own field of the same name wins. */
export interface GanttInteractionConfig {
  readOnly?: boolean;
  allowMove?: boolean;
  allowResize?: boolean;
  allowProgressChange?: boolean;
  allowLinkCreate?: boolean;
  allowLinkDelete?: boolean;
  allowTaskCreate?: boolean;
  /** Turns row reordering on - opt-in (default false). */
  allowReorder?: boolean;
  minDate?: string;
  maxDate?: string;
}

interface ResolvedTaskInteraction {
  canMove: boolean;
  canResize: boolean;
  canChangeProgress: boolean;
  canCreateLink: boolean;
  canDeleteLink: boolean;
  canReorder: boolean;
  minDate?: string;
  maxDate?: string;
}

// Module scope so the default argument keeps a stable identity
const NO_INTERACTION_CONFIG: GanttInteractionConfig = {};

// Precedence: `task.allowX` > `task.readOnly` > `config.allowX` > `config.readOnly` > allowed.
// Summary rows are never resizable and have no draggable progress - both roll up from children.
// Reordering is the exception: its floor is `false`, so only an explicit flag turns it on.
export function resolveTaskInteraction(
  task: Pick<
    Task,
    | 'readOnly'
    | 'allowMove'
    | 'allowResize'
    | 'allowProgressChange'
    | 'allowLinkCreate'
    | 'allowLinkDelete'
    | 'allowReorder'
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

  const canReorder =
    task.allowReorder ??
    (task.readOnly === true ? false : (config.allowReorder ?? false));

  const derived = task.isSummary === true;

  return {
    canMove: resolve(task.allowMove, config.allowMove),
    canResize:
      !derived &&
      resolve(task.allowResize, config.allowResize),
    canChangeProgress:
      !derived &&
      resolve(task.allowProgressChange, config.allowProgressChange),
    canCreateLink: resolve(task.allowLinkCreate, config.allowLinkCreate),
    canDeleteLink: resolve(task.allowLinkDelete, config.allowLinkDelete),
    canReorder,
    minDate: task.minDate ?? config.minDate,
    maxDate: task.maxDate ?? config.maxDate,
  };
}

// Chart-wide only - no entry point starts on a task, so there is no per-task rung
export function canCreateTasks(
  config: GanttInteractionConfig = NO_INTERACTION_CONFIG
): boolean {
  return config.allowTaskCreate ?? !config.readOnly;
}

// CSS custom properties a colored bar sets - an empty object leaves the theme tokens deciding
interface TaskColorVars {
  '--gantt-bar-color'?: string;
  '--gantt-bar-color-hover'?: string;
  '--gantt-progress-color'?: string;
  '--gantt-bar-text-color'?: string;
}

export function resolveTaskColors(color: string | undefined): TaskColorVars {
  const base = color?.trim();
  if (!base) return {};

  return {
    '--gantt-bar-color': base,
    '--gantt-bar-color-hover': `color-mix(in srgb, ${base} 86%, #000)`,
    '--gantt-progress-color': `color-mix(in srgb, ${base} 62%, #000)`,
    // Black or white, whichever the bar color can carry: `l` is the color's own lightness, and
    // dividing by the threshold then multiplying by -infinity clamps to one end or the other.
    // 0.5637 is cbrt(0.1791), the OKLab lightness of the relative luminance where black and white
    // tie on WCAG contrast. Anything higher (MUI ships 0.7 for its own palette) picks white on
    // mid-tone colors that read better in black; measured, 0.7 gets 8 of 18 sample colors wrong.
    // Done in CSS, not here, because `var(--brand)` is a legal color and JS cannot read its lightness.
    '--gantt-bar-text-color': `oklch(from ${base} clamp(0, (l / 0.5637 - 1) * -infinity, 1) 0 h)`,
  };
}
export interface TaskTransformed extends Task {
  barLeft: number;
  barWidth: number;
  depth: number;
  order: number;
  originalOrder: number;
  /** Row with children - its dates roll up, so resize and progress editing are off and dragging moves the subtree. */
  isSummary?: boolean;
  dependencies?: TaskDependency[];
}

export interface RenderedDependency extends TaskDependency {
  // Id of the successor that owns this dependency - `targetId` is the predecessor
  sourceId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
