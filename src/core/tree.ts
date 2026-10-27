import { normalizeProgress, Task } from "./types";
import dayjs from "./dates";

/** The minimum a task needs for the tree math - TaskTransformed fits as-is */
type TaskNode = Pick<Task, "id" | "parentId">;

/** A normalized tree built from `parentId`: orphans, self-references and cycles lose their parent link and become roots. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export interface TaskTree {
  /** Parent id -> child ids, in input order; a leaf has no key. */
  childIds: Map<string, string[]>;
  /** Task id -> normalized parent id, null for a root, an orphan or a cycle. */
  parentOf: Map<string, string | null>;
  /** Task id -> depth, 0 for a root. */
  depthOf: Map<string, number>;
  /** Root ids, in input order; `childIds` has no key for this sibling list. */
  rootIds: string[];
}

/** Builds the normalized `TaskTree` from each task's `parentId`; a cut link is not reported. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function buildTaskTree(tasks: TaskNode[]): TaskTree {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parentOf = new Map<string, string | null>();
  const childIds = new Map<string, string[]>();
  const depthOf = new Map<string, number>();
  const rootIds: string[] = [];

  const resolveParent = (task: TaskNode): string | null => {
    const parentId = task.parentId;
    if (!parentId || parentId === task.id || !byId.has(parentId)) return null;

    const seen = new Set([task.id]);
    let cursor: TaskNode | undefined = byId.get(parentId);
    while (cursor) {
      if (seen.has(cursor.id)) return null;
      seen.add(cursor.id);
      if (!cursor.parentId) break;
      cursor = byId.get(cursor.parentId);
    }
    return parentId;
  };

  for (const task of tasks) {
    parentOf.set(task.id, resolveParent(task));
  }

  for (const task of tasks) {
    const parentId = parentOf.get(task.id);
    if (!parentId) {
      rootIds.push(task.id);
      continue;
    }

    const siblings = childIds.get(parentId);
    if (siblings) siblings.push(task.id);
    else childIds.set(parentId, [task.id]);
  }

  for (const task of tasks) {
    let depth = 0;
    let cursor = parentOf.get(task.id) ?? null;
    while (cursor) {
      depth++;
      cursor = parentOf.get(cursor) ?? null;
    }
    depthOf.set(task.id, depth);
  }

  return { childIds, parentOf, depthOf, rootIds };
}

/** The subtree's ids, root first and breadth first; an id that is not in the tree yields an empty array. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function collectSubtreeIds(
  tasks: TaskNode[],
  rootId: string,
  tree: TaskTree = buildTaskTree(tasks)
): string[] {
  if (!tree.parentOf.has(rootId)) return [];

  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    const children = tree.childIds.get(ids[i]);
    if (children) ids.push(...children);
  }
  return ids;
}

export function getVisibleTasks<T extends TaskNode>(
  tasks: T[],
  collapsedIds: Iterable<string>,
  tree: TaskTree = buildTaskTree(tasks)
): T[] {
  const collapsed =
    collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);
  if (!collapsed.size) return tasks;

  const hasCollapsedAncestor = (id: string): boolean => {
    let cursor = tree.parentOf.get(id) ?? null;
    while (cursor) {
      if (collapsed.has(cursor)) return true;
      cursor = tree.parentOf.get(cursor) ?? null;
    }
    return false;
  };

  return tasks.filter((task) => !hasCollapsedAncestor(task.id));
}

/** The tasks with every parent recomputed as a summary row: dates always span its children, and a missing progress becomes their duration-weighted average. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function rollUpTasks(
  tasks: Task[],
  tree: TaskTree = buildTaskTree(tasks)
): Task[] {
  if (!tree.childIds.size) return tasks;

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parentIds = [...tree.childIds.keys()]
    .sort((a, b) => (tree.depthOf.get(b) ?? 0) - (tree.depthOf.get(a) ?? 0));

  const rolled = new Map<string, Task>();
  const latest = (id: string) => rolled.get(id) ?? byId.get(id);

  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (!parent) continue;

    const children = (tree.childIds.get(parentId) ?? [])
      .map(latest)
      .filter((child): child is Task => child !== undefined);

    let minStart = Infinity;
    let maxEnd = -Infinity;
    let weightedSum = 0;
    let totalWeight = 0;
    let plainSum = 0;
    let reported = false;

    for (const child of children) {
      const start = dayjs(child.startDate).valueOf();
      const end = dayjs(child.endDate).valueOf();

      if (!Number.isNaN(start)) minStart = Math.min(minStart, start);
      if (!Number.isNaN(end)) maxEnd = Math.max(maxEnd, end);

      const progress = normalizeProgress(child.progress);
      if (progress !== null) reported = true;

      const value = progress ?? 0;
      const duration =
        Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, end - start);
      weightedSum += value * duration;
      totalWeight += duration;
      plainSum += value;
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) continue;

    const percent =
      totalWeight > 0 ? weightedSum / totalWeight : plainSum / children.length;

    rolled.set(parentId, {
      ...parent,
      startDate: dayjs(minStart).toISOString(),
      endDate: dayjs(maxEnd).toISOString(),
      progress: parent.progress ?? (reported ? Math.round(percent) : undefined),
    });
  }

  if (!rolled.size) return tasks;
  return tasks.map((task) => rolled.get(task.id) ?? task);
}
