import { normalizeProgress, Task } from "./types";
import dayjs from "./dates";

/** The minimum a task needs for the tree math - TaskTransformed fits as-is */
type TaskNode = Pick<Task, "id" | "parentId">;

/**
 * A normalized tree built from parentId. Orphans, self-references and cycles lose their
 * parent link and become roots, so what comes out is always acyclic.
 */
export interface TaskTree {
  /** parent id -> child ids (in input order) */
  childIds: Map<string, string[]>;
  /** task id -> normalized parent id (null for a root, an orphan or a cycle) */
  parentOf: Map<string, string | null>;
  /** task id -> depth from the root */
  depthOf: Map<string, number>;
  /** Root ids, in input order - the sibling list childIds has no key for */
  rootIds: string[];
}

export function buildTaskTree(tasks: TaskNode[]): TaskTree {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parentOf = new Map<string, string | null>();
  const childIds = new Map<string, string[]>();
  const depthOf = new Map<string, number>();
  const rootIds: string[] = [];

  // Meeting an already-passed node while walking up means a cycle; every node is recorded, so this ends.
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

/**
 * The subtree's ids including the root itself (breadth first)
 * An id that is not in the tree yields an empty array
 */
export function collectSubtreeIds(
  tasks: TaskNode[],
  rootId: string,
  tree: TaskTree = buildTaskTree(tasks)
): string[] {
  if (!tree.parentOf.has(rootId)) return [];

  const ids = [rootId];
  // Acyclic by construction, so appending children needs no visited set
  for (let i = 0; i < ids.length; i++) {
    const children = tree.childIds.get(ids[i]);
    if (children) ids.push(...children);
  }
  return ids;
}

/**
 * The tasks left after dropping any task with a collapsed ancestor
 * Input order is preserved (row order is decided by the sequence sort)
 */
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

/** Duration-weighted average progress of the children - undefined when no child reports one */
function rollUpProgress(children: Task[]): number | undefined {
  let weightedSum = 0;
  let totalWeight = 0;
  let plainSum = 0;
  let reported = false;

  for (const child of children) {
    const progress = normalizeProgress(child.progress);
    if (progress !== null) reported = true;

    const value = progress ?? 0;
    const duration = Math.max(
      0,
      dayjs(child.endDate).valueOf() - dayjs(child.startDate).valueOf()
    );

    weightedSum += value * duration;
    totalWeight += duration;
    plainSum += value;
  }

  if (!reported) return undefined;

  // With only zero-duration children there is no weight, so fall back to a plain average
  const percent =
    totalWeight > 0 ? weightedSum / totalWeight : plainSum / children.length;
  return Math.round(percent);
}

/**
 * The tasks with every parent recomputed as a summary row: start/end always from the children
 * (deepest first, so a move travels all the way up); an explicit progress is left alone.
 */
export function rollUpTasks(
  tasks: Task[],
  tree: TaskTree = buildTaskTree(tasks)
): Task[] {
  if (!tree.childIds.size) return tasks;

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const parentIds = [...tree.childIds.keys()]
    .filter((id) => byId.has(id))
    .sort((a, b) => (tree.depthOf.get(b) ?? 0) - (tree.depthOf.get(a) ?? 0));

  // Only the parents that actually changed go in here
  const rolled = new Map<string, Task>();
  const latest = (id: string) => rolled.get(id) ?? byId.get(id);

  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (!parent) continue;

    const children = (tree.childIds.get(parentId) ?? [])
      .map(latest)
      .filter((child): child is Task => child !== undefined);
    if (!children.length) continue;

    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const child of children) {
      const start = dayjs(child.startDate).valueOf();
      const end = dayjs(child.endDate).valueOf();

      if (!Number.isNaN(start)) minStart = Math.min(minStart, start);
      if (!Number.isNaN(end)) maxEnd = Math.max(maxEnd, end);
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) continue;

    rolled.set(parentId, {
      ...parent,
      startDate: dayjs(minStart).toISOString(),
      endDate: dayjs(maxEnd).toISOString(),
      progress: parent.progress ?? rollUpProgress(children),
    });
  }

  if (!rolled.size) return tasks;
  return tasks.map((task) => rolled.get(task.id) ?? task);
}
