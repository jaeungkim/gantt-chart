import type { Dayjs } from 'dayjs';
import { CALENDAR_DAYS, type WorkingCalendar } from './calendar';
import dayjs from './dates';
import { isMilestoneTask, type DependencyType, type Task } from './types';

/**
 * How far a predecessor's move carries into its successors.
 *
 * - `off` - nothing propagates (the default; a chart behaves exactly as it did before)
 * - `shift-on-overlap` - a successor is pushed later only when a link would otherwise be
 *   broken, and is never pulled earlier
 * - `maintain-gap` - a successor sits exactly at its earliest legal date, so it follows the
 *   predecessor in both directions and the gap stays equal to the link's lag
 */
export type SchedulingPolicy = 'off' | 'shift-on-overlap' | 'maintain-gap';

/** One dependency, with both ends resolved */
export interface SchedulingLink {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  /** Signed, in the calendar's day unit */
  lag: number;
}

/** Stable identity for a link - used to tag the rendered arrow */
export function linkKey(link: SchedulingLink): string {
  return `${link.predecessorId}>${link.successorId}:${link.type}`;
}

export interface TaskGraph {
  byId: Map<string, Task>;
  links: SchedulingLink[];
  /** successor id -> the links that constrain it */
  incoming: Map<string, SchedulingLink[]>;
  /** predecessor id -> the links it constrains */
  outgoing: Map<string, SchedulingLink[]>;
  /** Topological order, predecessors first. Excludes anything caught in a cycle. */
  order: string[];
  /** Ids that could not be ordered because they sit on a cycle (null when there is none) */
  cycle: string[] | null;
}

/**
 * Builds the dependency graph and topologically sorts it (Kahn).
 *
 * Links pointing at a task that is not in the data are dropped, and anything caught in a
 * cycle is left out of `order` and reported in `cycle` - so every caller walks a finite,
 * acyclic list no matter what the data says.
 */
export function buildTaskGraph(tasks: Task[]): TaskGraph {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const links: SchedulingLink[] = [];
  const incoming = new Map<string, SchedulingLink[]>();
  const outgoing = new Map<string, SchedulingLink[]>();

  const push = (
    map: Map<string, SchedulingLink[]>,
    id: string,
    link: SchedulingLink
  ) => {
    const existing = map.get(id);
    if (existing) existing.push(link);
    else map.set(id, [link]);
  };

  for (const task of tasks) {
    for (const dependency of task.dependencies ?? []) {
      // Self-links and links to a task that is not in the data constrain nothing
      if (dependency.targetId === task.id) continue;
      if (!byId.has(dependency.targetId)) continue;

      const link: SchedulingLink = {
        predecessorId: dependency.targetId,
        successorId: task.id,
        type: dependency.type,
        lag: dependency.lag ?? 0,
      };
      links.push(link);
      push(incoming, link.successorId, link);
      push(outgoing, link.predecessorId, link);
    }
  }

  const indegree = new Map<string, number>();
  for (const task of tasks) {
    indegree.set(task.id, incoming.get(task.id)?.length ?? 0);
  }

  const queue = tasks.filter((task) => !indegree.get(task.id)).map((t) => t.id);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    order.push(id);
    for (const link of outgoing.get(id) ?? []) {
      const left = (indegree.get(link.successorId) ?? 0) - 1;
      indegree.set(link.successorId, left);
      if (left === 0) queue.push(link.successorId);
    }
  }

  const cycle =
    order.length === tasks.length
      ? null
      : tasks.map((t) => t.id).filter((id) => (indegree.get(id) ?? 0) > 0);

  return { byId, links, incoming, outgoing, order, cycle };
}

/**
 * A dependency path from `fromId` to `toId`, or null when there is none.
 * Walks successors, so the result reads predecessor-first.
 */
export function findPath(
  tasks: Task[],
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) return [fromId];

  const { outgoing } = buildTaskGraph(tasks);
  const cameFrom = new Map<string, string>();
  const seen = new Set([fromId]);
  const queue = [fromId];

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const link of outgoing.get(id) ?? []) {
      const next = link.successorId;
      if (seen.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, id);

      if (next === toId) {
        const path = [next];
        let cursor: string | undefined = id;
        while (cursor) {
          path.unshift(cursor);
          cursor = cameFrom.get(cursor);
        }
        return path;
      }
      queue.push(next);
    }
  }

  return null;
}

/**
 * Whether a new predecessor -> successor link can be added without closing a loop.
 *
 * Call this before writing a link into the data: a cycle that never gets created is a
 * cycle the engine never has to work around. `cycle` is the offending chain, ready to
 * put in an error message.
 */
export function canLink(
  tasks: Task[],
  predecessorId: string,
  successorId: string
): { ok: boolean; cycle: string[] | null } {
  if (predecessorId === successorId) {
    return { ok: false, cycle: [predecessorId, successorId] };
  }

  // The new link runs predecessor -> successor, so it closes a loop only when the
  // successor can already reach the predecessor.
  const back = findPath(tasks, successorId, predecessorId);
  if (!back) return { ok: true, cycle: null };
  return { ok: false, cycle: [...back, successorId] };
}

/** The instant a task starts (milestones are a single point at startDate) */
export function taskStart(task: Task): Dayjs {
  return dayjs(task.startDate);
}

/** The instant a task finishes (milestones are a single point at startDate) */
export function taskEnd(task: Task): Dayjs {
  return isMilestoneTask(task) ? dayjs(task.startDate) : dayjs(task.endDate);
}

/** The predecessor end of a link: FS and FF hang off the finish, SS and SF off the start */
export function linkSourceDate(link: SchedulingLink, predecessor: Task): Dayjs {
  return link.type === 'FS' || link.type === 'FF'
    ? taskEnd(predecessor)
    : taskStart(predecessor);
}

/** The successor end of a link: FS and SS constrain the start, FF and SF the finish */
export function linkTargetDate(link: SchedulingLink, successor: Task): Dayjs {
  return link.type === 'FS' || link.type === 'SS'
    ? taskStart(successor)
    : taskEnd(successor);
}

/**
 * How many days the successor must move for this link to hold.
 *
 * Positive means it has to move later, negative means it is sitting later than it needs
 * to. Whole days in the calendar's unit, so applying it keeps every time of day intact.
 */
export function linkDelta(
  link: SchedulingLink,
  predecessor: Task,
  successor: Task,
  calendar: WorkingCalendar
): number {
  const required = calendar.addDays(
    linkSourceDate(link, predecessor),
    link.lag
  );
  return calendar.daysUntil(linkTargetDate(link, successor), required);
}

/** Moves a task by whole days - both ends together, so its duration is untouched */
export function shiftTask(
  task: Task,
  days: number,
  calendar: WorkingCalendar
): Task {
  if (!days) return task;
  return {
    ...task,
    startDate: calendar.addDays(dayjs(task.startDate), days).toISOString(),
    endDate: calendar.addDays(dayjs(task.endDate), days).toISOString(),
  };
}

export interface ScheduleOptions {
  policy?: SchedulingPolicy;
  calendar?: WorkingCalendar;
  /**
   * The tasks that just moved. Only their successors are rescheduled, and the seeds
   * themselves are left exactly where the caller put them.
   * Omitted, the whole project is levelled.
   */
  seeds?: Iterable<string>;
  /** Pins summary rows - with hierarchy on their dates come from their children */
  hierarchy?: boolean;
  /** Called with the ids caught in a dependency cycle; those tasks are left alone */
  onCycle?: (taskIds: string[]) => void;
}

export interface ScheduleResult {
  /** The same array instance when nothing moved, so callers can skip the update */
  tasks: Task[];
  movedIds: string[];
  cycle: string[] | null;
}

/**
 * Propagates a move through the dependency graph.
 *
 * One forward pass in topological order: each task is shifted by the largest delta its
 * predecessors demand, then becomes the input for its own successors. Cycles are reported
 * and skipped rather than followed, so this always terminates.
 */
export function scheduleTasks(
  tasks: Task[],
  options: ScheduleOptions = {}
): ScheduleResult {
  const {
    policy = 'off',
    calendar = CALENDAR_DAYS,
    seeds,
    hierarchy = false,
    onCycle,
  } = options;

  if (policy === 'off' || tasks.length === 0) {
    return { tasks, movedIds: [], cycle: null };
  }

  const graph = buildTaskGraph(tasks);
  if (graph.cycle) onCycle?.(graph.cycle);

  // Only what the seeds can reach is up for rescheduling
  const reachable = collectDownstream(graph, seeds);
  const pinned = new Set<string>(seeds ?? []);
  if (hierarchy) {
    // A summary row's dates are rolled up from its children - moving it would be undone
    for (const task of tasks) if (task.parentId) pinned.add(task.parentId);
  }

  const current = new Map(graph.byId);
  const moved = new Map<string, Task>();

  for (const id of graph.order) {
    if (reachable && !reachable.has(id)) continue;
    if (pinned.has(id)) continue;

    const task = current.get(id);
    if (!task || task.manuallyScheduled) continue;

    const links = graph.incoming.get(id);
    if (!links?.length) continue;

    let delta = -Infinity;
    for (const link of links) {
      const predecessor = current.get(link.predecessorId);
      if (!predecessor) continue;
      delta = Math.max(delta, linkDelta(link, predecessor, task, calendar));
    }
    if (!Number.isFinite(delta)) continue;
    // shift-on-overlap only ever pushes a successor later
    if (policy === 'shift-on-overlap') delta = Math.max(0, delta);
    if (delta === 0) continue;

    const next = shiftTask(task, delta, calendar);
    current.set(id, next);
    moved.set(id, next);
  }

  if (!moved.size) return { tasks, movedIds: [], cycle: graph.cycle };

  return {
    tasks: tasks.map((task) => moved.get(task.id) ?? task),
    movedIds: [...moved.keys()],
    cycle: graph.cycle,
  };
}

/** Everything the seeds reach through their successors, seeds included (null = everything) */
function collectDownstream(
  graph: TaskGraph,
  seeds: Iterable<string> | undefined
): Set<string> | null {
  if (!seeds) return null;

  const queue = [...seeds];
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    for (const link of graph.outgoing.get(queue[i]) ?? []) {
      if (seen.has(link.successorId)) continue;
      seen.add(link.successorId);
      queue.push(link.successorId);
    }
  }
  return seen;
}
