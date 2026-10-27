import { TaskTransformed } from "shared/task";
import dayjs from "core/dates";

/** One rendered row: one task, or several sharing a `lane`. See https://gantt.jaeungkim.com/docs/ref/rows */
export interface GanttRow {
  /** Stable key - the ids on the row, joined with "+" */
  id: string;
  /** The row's tasks, never empty; each one's `order` is rewritten to the 1-based row number */
  tasks: TaskTransformed[];
  /** Indentation level, 0-based, taken from the row's first task */
  depth: number;
}

export function packLanes(tasks: TaskTransformed[]): TaskTransformed[][] {
  const ordered = tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const diff =
        dayjs(a.task.startDate).valueOf() - dayjs(b.task.startDate).valueOf();
      return diff !== 0 ? diff : a.index - b.index;
    });

  const rows: TaskTransformed[][] = [];
  const rowEnds: number[] = [];

  for (const { task } of ordered) {
    const start = dayjs(task.startDate).valueOf();
    const end = dayjs(task.endDate).valueOf();
    const slot = rowEnds.findIndex((rowEnd) => rowEnd <= start);

    if (slot === -1) {
      rows.push([task]);
      rowEnds.push(end);
    } else {
      rows[slot].push(task);
      rowEnds[slot] = Math.max(rowEnds[slot], end);
    }
  }

  return rows;
}

function toLaneRows(tasks: TaskTransformed[]): TaskTransformed[][] {
  const byLane = new Map<string, TaskTransformed[]>();
  for (const task of tasks) {
    if (!task.lane) continue;
    const members = byLane.get(task.lane);
    if (members) members.push(task);
    else byLane.set(task.lane, [task]);
  }

  const rows: TaskTransformed[][] = [];
  const done = new Set<string>();

  for (const task of tasks) {
    if (!task.lane) {
      rows.push([task]);
      continue;
    }
    if (done.has(task.lane)) continue;

    done.add(task.lane);
    rows.push(...packLanes(byLane.get(task.lane) ?? []));
  }

  return rows;
}

export function buildGanttRows(tasks: TaskTransformed[]): GanttRow[] {
  return toLaneRows(tasks).map((row, index) => {
    const order = index + 1;
    return {
      id: row.map((task) => task.id).join("+"),
      tasks: row.map((task) => (task.order === order ? task : { ...task, order })),
      depth: row[0].depth,
    };
  });
}
