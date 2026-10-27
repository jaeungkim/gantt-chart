export { normalizeProgress } from 'core/types';
export type {
  DependencyType,
  Task,
  TaskDependency,
} from 'core/types';

import type { Task, TaskDependency } from 'core/types';

/** The chart-wide interaction props as one type (there is no `interaction` prop); a task's own field of the same name wins. See https://gantt.jaeungkim.com/docs/ref/interaction-config */
export interface GanttInteractionConfig {
  /** Blocks every editing gesture on every task (default `false`); any `allowX` flag, on the chart or the task, beats it. */
  readOnly?: boolean;
  /** Dragging a bar along the timeline; allowed unless `readOnly`. */
  allowMove?: boolean;
  /** Dragging either bar edge and editing the detail panel's dates; allowed unless `readOnly`, never on a summary row. */
  allowResize?: boolean;
  /** Editing progress in the detail panel, as bars have no progress handle; allowed unless `readOnly`, never on a summary row. */
  allowProgressChange?: boolean;
  /** Drawing a dependency from or onto a bar; allowed unless `readOnly`. */
  allowLinkCreate?: boolean;
  /** Selecting and deleting a dependency arrow, where the successor's flag decides; allowed unless `readOnly`. */
  allowLinkDelete?: boolean;
  /** Drawing a task below the last row, the Add task button and `addTask()`; allowed unless `readOnly`, chart-wide only, and needs `onTaskCreate`. */
  allowTaskCreate?: boolean;
  /** Dragging a task-list row to a new position or parent; opt-in (default `false`), and never a row lane-mates share. */
  allowReorder?: boolean;
  /** Earliest date a drag or a built-in detail-panel edit can reach, as an ISO string read in UTC. */
  minDate?: string;
  /** Latest date a drag or a built-in detail-panel edit can reach, as an ISO string read in UTC. */
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

const NO_INTERACTION_CONFIG: GanttInteractionConfig = {};

export function resolveTaskInteraction(
  task: Task & { isSummary?: boolean },
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

export function canCreateTasks(
  config: GanttInteractionConfig = NO_INTERACTION_CONFIG
): boolean {
  return config.allowTaskCreate ?? !config.readOnly;
}

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
    '--gantt-bar-text-color': `oklch(from ${base} clamp(0, (l / 0.5637 - 1) * -infinity, 1) 0 h)`,
  };
}

/** A `Task` plus the layout the chart computed, as the click, select and detail callbacks receive it; output only, so edit `tasks` instead. See https://gantt.jaeungkim.com/docs/ref/task */
export interface TaskTransformed extends Task {
  /** Bar's left edge in px from the timeline's start; `0` while the timeline has no cells. */
  barLeft: number;
  /** Bar width in px, at least `1`; `0` while the timeline has no cells. */
  barWidth: number;
  /** Nesting level, `0` at the root: from the `parentId` chain with `hierarchy` on, from the `sequence` path otherwise. */
  depth: number;
  /** 1-based row number, shared by tasks packed onto one row; in the copy `onDetailChange` and `renderDetail` receive, it equals `originalOrder`. */
  order: number;
  /** 1-based position in `sequence` order, before lanes or collapsed parents change the rows. */
  originalOrder: number;
  /** Whether the task has children while `hierarchy` is on; its dates roll up, so resize and progress editing are off and a move takes the subtree along. */
  isSummary?: boolean;
  /** Copied through from `Task.dependencies`. */
  dependencies?: TaskDependency[];
}

export interface RenderedDependency extends TaskDependency {
  sourceId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  d: string;
}
