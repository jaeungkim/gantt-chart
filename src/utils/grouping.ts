import { GanttGroupBy } from "types/gantt";
import { isMilestoneTask, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { TaskTree } from "./tree";

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

/**
 * One rendered row
 *
 * Normally one task, several when they share a `lane`, none when the row is a
 * group header. The tree numbers (`level`/`posinset`/`setsize`) are the ARIA
 * values for the row, so the render never has to work them out again.
 */
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
  /**
   * The parentId tree (only when hierarchy is on)
   *
   * Given, a task's group is read off its root ancestor, so a subtree is never
   * split across two groups.
   */
  tree?: TaskTree;
  /** Header label for tasks whose group value is missing */
  ungroupedLabel?: string;
}

/** The row id for a group key */
export function groupRowId(key: string): string {
  return `${GROUP_ROW_PREFIX}${key}`;
}

/** A milestone occupies the single startDate point, so its end is its start */
function endOf(task: TaskTransformed): number {
  return isMilestoneTask(task)
    ? dayjs(task.startDate).valueOf()
    : dayjs(task.endDate).valueOf();
}

/**
 * Packs tasks that share a lane onto as few rows as possible
 *
 * Greedy interval partitioning: walking the tasks in start order, each one joins
 * the first row whose last task has already ended, and opens a new row when
 * every row is still busy. Non-overlapping tasks therefore end up side by side
 * on one row, and an overlap stacks onto the next row instead of drawing two
 * bars on top of each other.
 */
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
    // A task starting exactly when the previous one ends still shares the row -
    // the bars touch but do not overlap
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

/** Groups the tasks that carry a `lane` onto shared rows, in first-appearance order */
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

/** Resolves the group value of a task, "" when it has none */
function groupKeyOf(task: TaskTransformed, groupBy: GanttGroupBy): string {
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

/**
 * The row model the chart renders
 *
 * With no `groupBy` and no task carrying a `lane` this is one row per task, in
 * the order given - the behavior of a chart that sets neither.
 *
 * `groupBy` puts a header row in front of each group and indents its tasks by
 * one level; with `tree` (hierarchy on) the group comes from a task's root
 * ancestor, so grouping decides the top level and the parentId nesting is kept
 * inside the group. A group listed in `collapsedIds` keeps its header and drops
 * its rows.
 *
 * Every task's `order` is rewritten to its row number, so anything positioning
 * by row - the dependency arrows above all - follows grouping and lane packing
 * without knowing about either.
 */
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
    // The group of a task is the group of its root ancestor, so a subtree cannot
    // be torn apart by a field that differs between parent and child
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

/**
 * Turns the seeds into rows, filling in the ARIA tree numbers
 *
 * A row's parent is the nearest row above it one level shallower, so the same
 * pass covers a parentId hierarchy, a sequence-derived depth and group headers
 * without needing to know which produced the depths.
 */
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
      // Only rewrapped when the row number actually moved - an ungrouped chart
      // hands back the very objects it was given
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
