import { Task } from 'types/task';

/**
 * Field values one task changed by, recorded per gesture.
 *
 * Only the keys that actually differ are stored, so a step costs a handful of
 * strings rather than a copy of the task array.
 */
export interface TaskPatch {
  id: string;
  /** Values from before the gesture - what undo writes back */
  before: Partial<Task>;
  /** Values from after the gesture - what redo writes back */
  after: Partial<Task>;
}

/** One user gesture. A subtree drag that moved 20 rows is still one entry. */
export type HistoryEntry = TaskPatch[];

export interface HistoryStack {
  /** Oldest step first - the last one is what undo pops */
  past: HistoryEntry[];
  /** Steps undone and still redoable, newest first */
  future: HistoryEntry[];
}

export const EMPTY_HISTORY: HistoryStack = { past: [], future: [] };

/** How many steps are kept when no `historyLimit` is given */
export const DEFAULT_HISTORY_LIMIT = 100;

/**
 * The keys whose values differ between two versions of a task, or null when
 * nothing changed.
 *
 * Comparison is `!==`, so object fields (`dependencies`) match while the gesture
 * spreads the same reference through - which every gesture does.
 */
function changedFields(
  before: Task,
  after: Task
): Pick<TaskPatch, 'before' | 'after'> | null {
  const beforeValues: Record<string, unknown> = {};
  const afterValues: Record<string, unknown> = {};
  let changed = false;

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const prev = (before as unknown as Record<string, unknown>)[key];
    const next = (after as unknown as Record<string, unknown>)[key];
    if (prev === next) continue;

    beforeValues[key] = prev;
    afterValues[key] = next;
    changed = true;
  }

  return changed ? { before: beforeValues, after: afterValues } : null;
}

/**
 * Builds the undo step for one gesture, or null when the change cannot be
 * inverted by a field patch.
 *
 * Every gesture today rewrites fields on existing rows (`tasks.map(...)`), which
 * is exactly what a patch can undo. A change that adds, removes or replaces a row
 * returns null instead of a half-correct entry, and the caller drops the history
 * rather than storing a step that would corrupt the data on replay.
 */
export function diffTasks(before: Task[], after: Task[]): HistoryEntry | null {
  if (before.length !== after.length) return null;

  const byId = new Map(before.map((task) => [task.id, task]));
  const entry: HistoryEntry = [];

  for (const next of after) {
    const prev = byId.get(next.id);
    if (!prev) return null;

    const changed = changedFields(prev, next);
    if (changed) entry.push({ id: next.id, ...changed });
  }

  return entry;
}

/** Writes one direction of a step back onto the tasks it touched */
export function applyPatches(
  tasks: Task[],
  entry: HistoryEntry,
  direction: 'before' | 'after'
): Task[] {
  if (!entry.length) return tasks;

  const byId = new Map(entry.map((patch) => [patch.id, patch]));
  return tasks.map((task) => {
    const patch = byId.get(task.id);
    return patch ? { ...task, ...patch[direction] } : task;
  });
}

/** Trims a stack down to the newest `limit` steps */
function trimPast(past: HistoryEntry[], limit: number): HistoryEntry[] {
  return past.length > limit ? past.slice(past.length - limit) : past;
}

/**
 * Records a step.
 *
 * A gesture that changed nothing is not a step. A new action branches the
 * timeline, so anything that was undone stops being redoable.
 */
export function pushHistory(
  stack: HistoryStack,
  entry: HistoryEntry,
  limit: number
): HistoryStack {
  if (!entry.length) return stack;
  if (limit <= 0) return EMPTY_HISTORY;

  return { past: trimPast([...stack.past, entry], limit), future: [] };
}

/** Applies a new depth to an existing stack, dropping the steps that no longer fit */
export function limitHistory(stack: HistoryStack, limit: number): HistoryStack {
  if (limit <= 0) return EMPTY_HISTORY;

  const past = trimPast(stack.past, limit);
  return past === stack.past ? stack : { past, future: stack.future };
}

/** Moves the newest step from past to future. null when there is nothing to undo. */
export function popUndo(
  stack: HistoryStack
): { stack: HistoryStack; entry: HistoryEntry } | null {
  const entry = stack.past[stack.past.length - 1];
  if (!entry) return null;

  return {
    stack: { past: stack.past.slice(0, -1), future: [entry, ...stack.future] },
    entry,
  };
}

/** Moves the newest undone step back onto past. null when there is nothing to redo. */
export function popRedo(
  stack: HistoryStack
): { stack: HistoryStack; entry: HistoryEntry } | null {
  const [entry, ...rest] = stack.future;
  if (!entry) return null;

  return { stack: { past: [...stack.past, entry], future: rest }, entry };
}
