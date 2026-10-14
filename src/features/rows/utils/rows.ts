import { TaskTransformed } from "shared/task";
import dayjs from "core/dates";

/** One rendered row: one task, or several sharing a `lane` */
export interface GanttRow {
  /** Stable key - the ids on the row, joined with "+" */
  id: string;
  tasks: TaskTransformed[];
  /** Indentation level, 0-based */
  depth: number;
  /** `aria-level`, 1-based */
  level: number;
  /** `aria-posinset` among the rows that share a parent */
  posinset: number;
  /** `aria-setsize` for that same set */
  setsize: number;
}

/** Whether the row carries an expander: hierarchy on, and the task has children */
export function isRowExpandable(row: GanttRow, hierarchy: boolean): boolean {
  return hierarchy && !!row.tasks[0]?.isSummary;
}

function endOf(task: TaskTransformed): number {
  return dayjs(task.endDate).valueOf();
}

/** Packs lane-sharing tasks onto as few rows as possible (greedy interval partitioning by start) */
export function packLanes(tasks: TaskTransformed[]): TaskTransformed[][] {
  if (tasks.length < 2) return tasks.length ? [[...tasks]] : [];

  // Ties keep the incoming order, so the packing is stable for equal starts
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
    // `<=` so touching bars (one starts as the last ends) still share the row
    const slot = rowEnds.findIndex((end) => end <= start);

    if (slot === -1) {
      rows.push([task]);
      rowEnds.push(endOf(task));
    } else {
      rows[slot].push(task);
      rowEnds[slot] = Math.max(rowEnds[slot], endOf(task));
    }
  }

  return rows;
}

// Groups the tasks that carry a `lane` onto shared rows, in first-appearance order
function toLaneRows(tasks: TaskTransformed[]): TaskTransformed[][] {
  const byLane = new Map<string, TaskTransformed[]>();
  for (const task of tasks) {
    if (!task.lane) continue;
    const members = byLane.get(task.lane);
    if (members) members.push(task);
    else byLane.set(task.lane, [task]);
  }
  if (!byLane.size) return tasks.map((task) => [task]);

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

/** The row model the chart renders; every task's `order` is rewritten to its row number */
export function buildGanttRows(tasks: TaskTransformed[]): GanttRow[] {
  const seeds = toLaneRows(tasks);

  const ids = seeds.map((row) => row.map((task) => task.id).join("+"));

  // A row's parent is the nearest row above it one level shallower
  const parentIds: string[] = [];
  const setsizes = new Map<string, number>();
  const lastAtDepth: string[] = [];

  seeds.forEach((row, index) => {
    const depth = row[0].depth;
    const parentId = depth === 0 ? "" : lastAtDepth[depth - 1] ?? "";
    parentIds.push(parentId);
    setsizes.set(parentId, (setsizes.get(parentId) ?? 0) + 1);

    lastAtDepth[depth] = ids[index];
    lastAtDepth.length = depth + 1;
  });

  const seen = new Map<string, number>();

  return seeds.map((row, index) => {
    const parentId = parentIds[index];
    const posinset = (seen.get(parentId) ?? 0) + 1;
    seen.set(parentId, posinset);

    const depth = row[0].depth;
    const order = index + 1;
    return {
      id: ids[index],
      // Only rewrapped when the row number moved, so unchanged tasks keep identity
      tasks: row.map((task) => (task.order === order ? task : { ...task, order })),
      depth,
      level: depth + 1,
      posinset,
      setsize: setsizes.get(parentId) ?? 1,
    };
  });
}
