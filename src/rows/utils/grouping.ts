import { GanttGroupBy } from "shared/types";
import { TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import { TaskTree } from "core/tree";

/** Prefix the collapsed-id set uses for a group header row */
export const GROUP_ROW_PREFIX = "group:";

/** Label a task with no group value falls into */
export const DEFAULT_UNGROUPED_LABEL = "Ungrouped";

export interface GanttRowGroup {
  /** The raw value `groupBy` produced ("" for the ungrouped bucket) */
  key: string;
  /** What the header shows */
  label: string;
  /** How many tasks the group holds (rows can be fewer - lanes share a row) */
  count: number;
}

/** One rendered row: one task, several sharing a `lane`, or none for a group header */
export interface GanttRow {
  /** Stable key - the group id for a header, otherwise the ids on the row */
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
  /** Set only on a group header row */
  group?: GanttRowGroup;
}

export interface BuildGanttRowsOptions {
  /** Field name or accessor deciding which group a task belongs to */
  groupBy?: GanttGroupBy;
  /** Collapsed group ids (task ids in the same set are ignored here - the tree filter handles those) */
  collapsedIds?: ReadonlySet<string>;
  /** The parentId tree (hierarchy on); a task's group is read off its root ancestor */
  tree?: TaskTree;
  /** Header label for tasks whose group value is missing */
  ungroupedLabel?: string;
}

/** The row id for a group key */
export function groupRowId(key: string): string {
  return `${GROUP_ROW_PREFIX}${key}`;
}

/** Whether the row carries an expander: always for a group header, otherwise hierarchy + children */
export function isRowExpandable(row: GanttRow, hierarchy: boolean): boolean {
  return !!row.group || (hierarchy && !!row.tasks[0]?.isSummary);
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

/** The group value a task falls into - "" for the ungrouped bucket */
export function groupKeyOf(
  task: TaskTransformed,
  groupBy: GanttGroupBy
): string {
  const value =
    typeof groupBy === "function"
      ? groupBy(task)
      : (task as unknown as Record<string, unknown>)[groupBy];

  return value === null || value === undefined || value === ""
    ? ""
    : String(value);
}

interface RowSeed {
  tasks: TaskTransformed[];
  depth: number;
  group?: GanttRowGroup;
}

/** The row model the chart renders; every task's `order` is rewritten to its row number */
export function buildGanttRows(
  tasks: TaskTransformed[],
  options: BuildGanttRowsOptions = {}
): GanttRow[] {
  const {
    groupBy,
    collapsedIds,
    tree,
    ungroupedLabel = DEFAULT_UNGROUPED_LABEL,
  } = options;

  const seeds: RowSeed[] = [];

  if (groupBy === undefined) {
    for (const row of toLaneRows(tasks)) {
      seeds.push({ tasks: row, depth: row[0].depth });
    }
  } else {
    // A task's group is its root ancestor's, so a subtree is never split across groups
    const byId = tree ? new Map(tasks.map((task) => [task.id, task])) : null;
    const rootOf = (task: TaskTransformed): TaskTransformed => {
      if (!tree || !byId) return task;

      let id = task.id;
      let parentId = tree.parentOf.get(id) ?? null;
      while (parentId) {
        id = parentId;
        parentId = tree.parentOf.get(id) ?? null;
      }
      return byId.get(id) ?? task;
    };

    // Insertion order is first-appearance order, which is the sequence order
    const buckets = new Map<string, TaskTransformed[]>();
    for (const task of tasks) {
      const key = groupKeyOf(rootOf(task), groupBy);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(task);
      else buckets.set(key, [task]);
    }

    for (const [key, members] of buckets) {
      seeds.push({
        tasks: [],
        depth: 0,
        group: {
          key,
          label: key === "" ? ungroupedLabel : key,
          count: members.length,
        },
      });

      if (collapsedIds?.has(groupRowId(key))) continue;

      for (const row of toLaneRows(members)) {
        seeds.push({ tasks: row, depth: row[0].depth + 1 });
      }
    }
  }

  return numberRows(seeds);
}

// A row's parent is the nearest row above it one level shallower, whatever produced the depths
function numberRows(seeds: RowSeed[]): GanttRow[] {
  const ids = seeds.map((seed) =>
    seed.group ? groupRowId(seed.group.key) : seed.tasks.map((t) => t.id).join("+")
  );

  const parentIds: string[] = [];
  const setsizes = new Map<string, number>();
  const lastAtDepth: string[] = [];

  seeds.forEach((seed, index) => {
    const parentId = seed.depth === 0 ? "" : lastAtDepth[seed.depth - 1] ?? "";
    parentIds.push(parentId);
    setsizes.set(parentId, (setsizes.get(parentId) ?? 0) + 1);

    lastAtDepth[seed.depth] = ids[index];
    lastAtDepth.length = seed.depth + 1;
  });

  const seen = new Map<string, number>();

  return seeds.map((seed, index) => {
    const parentId = parentIds[index];
    const posinset = (seen.get(parentId) ?? 0) + 1;
    seen.set(parentId, posinset);

    const order = index + 1;
    return {
      id: ids[index],
      // Only rewrapped when the row number moved, so unchanged tasks keep identity
      tasks: seed.tasks.map((task) =>
        task.order === order ? task : { ...task, order }
      ),
      depth: seed.depth,
      level: seed.depth + 1,
      posinset,
      setsize: setsizes.get(parentId) ?? 1,
      group: seed.group,
    };
  });
}
