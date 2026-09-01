import {
  GanttBeforeChangeHandler,
  GanttChangeType,
  GanttTaskChange,
} from 'types/gantt';
import { Task } from 'types/task';

/** How long a rolled-back bar animates back - matches --gantt-transition-normal */
export const REVERT_DURATION_MS = 200;

/** What the caller should do once the before-handler has answered */
export type MutationOutcome = 'commit' | 'rollback' | 'stale';

/**
 * The gate's key for a gesture
 *
 * Moves and resizes both rewrite the dates, so they share a lane and supersede each
 * other; a progress edit runs in its own lane and leaves a pending date change alone.
 */
export function mutationKey(type: GanttChangeType, taskId: string): string {
  return `${type === 'progress' ? 'progress' : 'dates'}:${taskId}`;
}

export interface BuildTaskChangeParams {
  type: GanttChangeType;
  /** The bar the user grabbed */
  taskId: string;
  /** Ids the gesture rewrites - more than one when a summary bar carries its subtree */
  changedIds: string[];
  /** The task array as it was before the gesture */
  previous: Task[];
  /** The task array the gesture wants to commit */
  next: Task[];
  edge?: 'start' | 'end';
}

/**
 * Builds the payload handed to `onBeforeTaskChange`
 *
 * `changedTasks` and `previousTasks` line up index for index, so a host can diff the two
 * without looking anything up.
 */
export function buildTaskChange({
  type,
  taskId,
  changedIds,
  previous,
  next,
  edge,
}: BuildTaskChangeParams): GanttTaskChange {
  const changed = new Set(changedIds);
  const before = new Map(previous.map((task) => [task.id, task]));

  // Driven off `next` so both arrays come out in render order, not in the order the
  // subtree walk happened to collect the ids
  const changedTasks = next.filter((task) => changed.has(task.id));
  const previousTasks = changedTasks
    .map((task) => before.get(task.id))
    .filter((task): task is Task => task !== undefined);

  return {
    type,
    task: next.find((task) => task.id === taskId) ?? changedTasks[0],
    changedTasks,
    previousTasks,
    tasks: next,
    edge,
  };
}

/**
 * Decides commit or rollback for gestures whose before-handler may still be in flight
 *
 * A gesture claims its lane on the first movement and settles once the handler answers.
 * If another gesture claimed the same lane in between, this one lost the bar and its
 * answer is dropped ('stale') - otherwise a slow veto would drag a bar the user has since
 * moved somewhere else back to a position nobody asked for.
 */
export function createMutationGate() {
  const generations = new Map<string, number>();

  return {
    /** Claims a lane and returns the token identifying this gesture */
    begin(key: string): number {
      const token = (generations.get(key) ?? 0) + 1;
      generations.set(key, token);
      return token;
    },

    /** Runs the handler and reports what the caller should do with the result */
    async settle(
      key: string,
      token: number,
      handler: GanttBeforeChangeHandler,
      change: GanttTaskChange
    ): Promise<MutationOutcome> {
      let vetoed: boolean;
      try {
        // Only an explicit false is a veto - undefined (the common `void` handler) commits
        vetoed = (await handler(change)) === false;
      } catch {
        // A throw or a rejected promise is the failed-server case: roll back
        vetoed = true;
      }

      if (generations.get(key) !== token) return 'stale';
      return vetoed ? 'rollback' : 'commit';
    },
  };
}

export type MutationGate = ReturnType<typeof createMutationGate>;
