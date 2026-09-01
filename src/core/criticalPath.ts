import type { Dayjs } from 'dayjs';
import { CALENDAR_DAYS, type WorkingCalendar } from './calendar';
import {
  buildTaskGraph,
  linkKey,
  linkSourceDate,
  linkTargetDate,
  taskEnd,
  taskStart,
  type SchedulingLink,
  type TaskGraph,
} from './scheduling';
import { normalizeProgress, type Task } from './types';

/**
 * Critical path method over the dependency graph.
 *
 * Every task carries real dates, so its own start acts as a "no earlier than" constraint:
 * the forward pass moves a task later when a predecessor demands it and never earlier, and
 * the backward pass works out how much later each task could still finish without pushing
 * the project's end out. Zero difference between the two is zero slack - the critical path.
 *
 * Everything is measured as a whole-day shift of the task's own dates, so times of day
 * survive untouched and the numbers are working days whenever the calendar says so.
 */

export interface EarlyDates {
  start: Dayjs;
  finish: Dayjs;
  /** Days later than the task's own dates */
  shift: number;
}

export interface LateDates {
  start: Dayjs;
  finish: Dayjs;
  /** Days later than the task's own dates the task could still run */
  shift: number;
}

export interface TaskScheduleMetrics {
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  /** Days a task can slip before the project's finish moves */
  totalSlack: number;
  /** Days a task can slip before any successor's early start moves */
  freeSlack: number;
  critical: boolean;
  /** Calendar days, or working days when the working-day calendar is on */
  duration: number;
}

export interface CriticalPathResult {
  metrics: Map<string, TaskScheduleMetrics>;
  criticalTaskIds: Set<string>;
  /** Keys from `linkKey` for the links that lie along the critical path */
  criticalLinkIds: Set<string>;
  /** Ids caught in a dependency cycle - they get no metrics */
  cycle: string[] | null;
  /** The project's earliest finish (UTC ISO string), or null with no tasks */
  projectFinish: string | null;
}

export interface CriticalPathOptions {
  calendar?: WorkingCalendar;
}

/** The late-side anchor a link constrains on its successor */
function lateTargetDate(link: SchedulingLink, late: LateDates): Dayjs {
  return link.type === 'FS' || link.type === 'SS' ? late.start : late.finish;
}

/** The early-side anchor a link constrains on its successor */
function earlyTargetDate(link: SchedulingLink, early: EarlyDates): Dayjs {
  return link.type === 'FS' || link.type === 'SS' ? early.start : early.finish;
}

function ownDates(task: Task, shift: number, calendar: WorkingCalendar) {
  return {
    start: calendar.addDays(taskStart(task), shift),
    finish: calendar.addDays(taskEnd(task), shift),
    shift,
  };
}

/**
 * Earliest each task can run given its predecessors, walked predecessors-first.
 * A task with no predecessor stays on its own dates.
 */
export function forwardPass(
  tasks: Task[],
  calendar: WorkingCalendar = CALENDAR_DAYS,
  graph: TaskGraph = buildTaskGraph(tasks)
): Map<string, EarlyDates> {
  const early = new Map<string, EarlyDates>();

  for (const id of graph.order) {
    const task = graph.byId.get(id);
    if (!task) continue;

    let shift = 0;
    for (const link of graph.incoming.get(id) ?? []) {
      const predecessor = graph.byId.get(link.predecessorId);
      const predecessorEarly = early.get(link.predecessorId);
      if (!predecessor || !predecessorEarly) continue;

      const source = calendar.addDays(
        calendar.addDays(
          linkSourceDate(link, predecessor),
          predecessorEarly.shift
        ),
        link.lag
      );
      // Own dates act as "start no earlier than", so a task is never pulled backwards
      shift = Math.max(
        shift,
        calendar.daysUntil(linkTargetDate(link, task), source)
      );
    }

    early.set(id, ownDates(task, shift, calendar));
  }

  // Anything on a cycle was left out of the order - report it where it sits
  for (const task of tasks) {
    if (!early.has(task.id)) early.set(task.id, ownDates(task, 0, calendar));
  }

  return early;
}

/**
 * Latest each task can run without moving the project's finish, walked successors-first.
 *
 * Takes the forward pass's output rather than recomputing it, so it can be exercised on
 * its own with hand-written early dates.
 */
export function backwardPass(
  tasks: Task[],
  early: Map<string, EarlyDates>,
  calendar: WorkingCalendar = CALENDAR_DAYS,
  graph: TaskGraph = buildTaskGraph(tasks),
  projectFinish?: Dayjs
): Map<string, LateDates> {
  const late = new Map<string, LateDates>();

  const finish =
    projectFinish ??
    [...early.values()].reduce<Dayjs | null>(
      (latest, dates) =>
        !latest || dates.finish.valueOf() > latest.valueOf()
          ? dates.finish
          : latest,
      null
    );
  if (!finish) return late;

  for (let i = graph.order.length - 1; i >= 0; i--) {
    const id = graph.order[i];
    const task = graph.byId.get(id);
    if (!task) continue;

    let shift = Infinity;
    for (const link of graph.outgoing.get(id) ?? []) {
      const successorLate = late.get(link.successorId);
      if (!successorLate) continue;

      shift = Math.min(
        shift,
        calendar.daysUpTo(
          linkSourceDate(link, task),
          lateTargetDate(link, successorLate)
        ) - link.lag
      );
    }

    // Nothing downstream: the task may run until the project's own finish
    if (!Number.isFinite(shift)) {
      shift = calendar.daysUpTo(taskEnd(task), finish);
    }

    late.set(id, ownDates(task, shift, calendar));
  }

  return late;
}

/** Forward pass, backward pass, and the slack numbers that fall out of the two */
export function computeCriticalPath(
  tasks: Task[],
  options: CriticalPathOptions = {}
): CriticalPathResult {
  const calendar = options.calendar ?? CALENDAR_DAYS;
  const graph = buildTaskGraph(tasks);
  const metrics = new Map<string, TaskScheduleMetrics>();
  const criticalTaskIds = new Set<string>();
  const criticalLinkIds = new Set<string>();

  if (!tasks.length) {
    return {
      metrics,
      criticalTaskIds,
      criticalLinkIds,
      cycle: graph.cycle,
      projectFinish: null,
    };
  }

  const early = forwardPass(tasks, calendar, graph);
  const late = backwardPass(tasks, early, calendar, graph);

  // Days a task can slip before it moves a successor's early start - per link, so the
  // binding links can be picked out afterwards
  const linkFloat = new Map<string, number>();
  for (const link of graph.links) {
    const predecessor = graph.byId.get(link.predecessorId);
    const predecessorEarly = early.get(link.predecessorId);
    const successorEarly = early.get(link.successorId);
    if (!predecessor || !predecessorEarly || !successorEarly) continue;

    linkFloat.set(
      linkKey(link),
      calendar.daysUpTo(
        linkSourceDate(link, predecessor),
        earlyTargetDate(link, successorEarly)
      ) -
        link.lag -
        predecessorEarly.shift
    );
  }

  for (const id of graph.order) {
    const task = graph.byId.get(id);
    const earlyDates = early.get(id);
    const lateDates = late.get(id);
    if (!task || !earlyDates || !lateDates) continue;

    const totalSlack = lateDates.shift - earlyDates.shift;
    const outgoing = graph.outgoing.get(id) ?? [];
    const freeSlack = outgoing.length
      ? Math.max(
          0,
          Math.min(...outgoing.map((link) => linkFloat.get(linkKey(link)) ?? 0))
        )
      : totalSlack;

    // A finished task cannot delay anything, so it is never on the critical path
    const done = normalizeProgress(task.progress) === 100;
    const critical = totalSlack === 0 && !done;
    if (critical) criticalTaskIds.add(id);

    metrics.set(id, {
      earlyStart: earlyDates.start.toISOString(),
      earlyFinish: earlyDates.finish.toISOString(),
      lateStart: lateDates.start.toISOString(),
      lateFinish: lateDates.finish.toISOString(),
      totalSlack,
      freeSlack,
      critical,
      duration: calendar.daysBetween(taskStart(task), taskEnd(task)),
    });
  }

  // A link is on the critical path when both ends are critical and it is what holds the
  // successor where it is - a slack link between two critical tasks is not part of the chain
  for (const link of graph.links) {
    if (!criticalTaskIds.has(link.predecessorId)) continue;
    if (!criticalTaskIds.has(link.successorId)) continue;
    if (linkFloat.get(linkKey(link)) !== 0) continue;
    criticalLinkIds.add(linkKey(link));
  }

  const projectFinish = [...early.values()].reduce<Dayjs | null>(
    (latest, dates) =>
      !latest || dates.finish.valueOf() > latest.valueOf() ? dates.finish : latest,
    null
  );

  return {
    metrics,
    criticalTaskIds,
    criticalLinkIds,
    cycle: graph.cycle,
    projectFinish: projectFinish?.toISOString() ?? null,
  };
}
