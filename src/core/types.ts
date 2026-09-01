/**
 * The task data model - the part of it the headless core owns.
 *
 * Everything here is plain data and pure functions: no React, no DOM, no pixels.
 * `src/types/task.ts` re-exports these and adds the render-side types (bar geometry,
 * arrow coordinates) on top.
 */

export type TaskType = 'task' | 'milestone';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
  /** The predecessor's id - a task's `dependencies` list the tasks it waits on */
  targetId: string;
  type: DependencyType;
  /**
   * Signed delay between the two ends of the link, in days
   *
   * Positive is lag (wait this long after the predecessor), negative is lead (overlap).
   * Counted in working days when the working-day calendar is on, calendar days otherwise.
   */
  lag?: number;
}

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
  /** The scheduling engine never moves this task; it still constrains its successors */
  manuallyScheduled?: boolean;
  /** Planned start snapshot - drawn as a thin bar under the live one (UTC ISO string) */
  baselineStart?: string;
  /** Planned end snapshot (UTC ISO string) */
  baselineEnd?: string;
}

export function isMilestoneTask(task: Pick<Task, 'type'>): boolean {
  return task.type === 'milestone';
}

/** Normalizes progress into the 0-100 range; null when the value is missing or invalid */
export function normalizeProgress(progress: number | undefined): number | null {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.min(100, Math.max(0, progress));
}
