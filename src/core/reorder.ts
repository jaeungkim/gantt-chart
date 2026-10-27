import { Task } from "./types";
import { buildTaskTree, collectSubtreeIds, TaskTree } from "./tree";

/** Where a task is going: a parent, and a slot among that parent's children. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export interface GanttTaskMove {
  /** The task to move; its subtree moves with it. */
  taskId: string;
  /** New parent, null for the root level. */
  toParentId: string | null;
  /** Slot among the new parent's children, counted in the list as it stands after the move; out-of-range values clamp. */
  toIndex: number;
}

/** The move as applied, with the clamped `toIndex`; `afterId`/`beforeId` give the same slot for a position-based API. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export interface GanttTaskMoveChange extends GanttTaskMove {
  /** Parent before the move, null for the root level. */
  fromParentId: string | null;
  /** Slot among that parent's children before the move. */
  fromIndex: number;
  /** Sibling the task now follows; null when it is the first child. */
  afterId: string | null;
  /** Sibling the task now precedes; null when it is the last child. */
  beforeId: string | null;
}

export type GanttDropMode = "before" | "after" | "child";

/** Why a move was refused; `validateMove` returns null for an allowed one. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export type GanttMoveRejection =
  | "unknown-task"
  | "unknown-parent"
  | "read-only"
  | "cycle"
  | "reparent-disabled"
  | "no-op";

/** Options `validateMove` and `moveTask` share. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export interface GanttMoveOptions {
  /** Whether the `parentId` hierarchy is on; off, depth comes from `sequence` and a reparent is refused. */
  hierarchy: boolean;
  /** Whether this task may be moved at all; `false` is refused as `"read-only"`, and left out, every task may. */
  canReorder?: (task: Task) => boolean;
}

interface TaskOrder {
  parentOf: ReadonlyMap<string, string | null>;
  childrenOf: (parentId: string | null) => readonly string[];
}

function parseSequence(sequence: string): number[] {
  return sequence.split(".").map(Number);
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(Math.trunc(index) || 0, 0), length);
}

/** Sorts a copy of the tasks by `sequence`, comparing segments as numbers; this is the chart's row order before lanes pack rows. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function sortTasksBySequence<T extends Pick<Task, "sequence">>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    const aParts = parseSequence(a.sequence);
    const bParts = parseSequence(b.sequence);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
}

interface Forest {
  children: Map<string, string[]>;
  parentOf: Map<string, string | null>;
}

const ROOT = "";

function buildForest(
  sorted: Task[],
  hierarchy: boolean,
  tree?: TaskTree
): Forest {
  const parentOf = new Map<string, string | null>();
  const children = new Map<string, string[]>();

  if (hierarchy) {
    for (const [id, parent] of (tree ?? buildTaskTree(sorted)).parentOf) {
      parentOf.set(id, parent);
    }
  } else {
    const idBySequence = new Map<string, string>();
    for (const task of sorted) {
      if (!idBySequence.has(task.sequence)) {
        idBySequence.set(task.sequence, task.id);
      }
    }
    for (const task of sorted) {
      const cut = task.sequence.lastIndexOf(".");
      const prefix = cut === -1 ? null : task.sequence.slice(0, cut);
      const parentId = prefix ? (idBySequence.get(prefix) ?? null) : null;
      parentOf.set(task.id, parentId === task.id ? null : parentId);
    }
  }

  for (const task of sorted) {
    const key = parentOf.get(task.id) ?? ROOT;
    const siblings = children.get(key);
    if (siblings) siblings.push(task.id);
    else children.set(key, [task.id]);
  }

  return { children, parentOf };
}

const NO_IDS: readonly string[] = [];

export function buildTaskOrder(tasks: Task[], hierarchy: boolean): TaskOrder {
  const { children, parentOf } = buildForest(
    sortTasksBySequence(tasks),
    hierarchy
  );

  return {
    parentOf,
    childrenOf: (parentId) => children.get(parentId ?? ROOT) ?? NO_IDS,
  };
}

export function moveForDrop(
  order: TaskOrder,
  taskId: string,
  targetId: string,
  mode: GanttDropMode
): GanttTaskMove {
  const toParentId =
    mode === "child" ? targetId : (order.parentOf.get(targetId) ?? null);
  const siblings = order.childrenOf(toParentId);

  const slot =
    mode === "child"
      ? siblings.length
      : siblings.indexOf(targetId) + (mode === "after" ? 1 : 0);

  const fromIndex = siblings.indexOf(taskId);

  return {
    taskId,
    toParentId,
    toIndex: fromIndex !== -1 && fromIndex < slot ? slot - 1 : slot,
  };
}

/** Whether a move can be applied: null when it can, otherwise the reason it cannot. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function validateMove(
  tasks: Task[],
  move: GanttTaskMove,
  options: GanttMoveOptions
): GanttMoveRejection | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const task = byId.get(move.taskId);
  if (!task) return "unknown-task";

  if (move.toParentId && !byId.has(move.toParentId)) return "unknown-parent";

  if (options.canReorder && !options.canReorder(task)) return "read-only";

  const sorted = sortTasksBySequence(tasks);
  const tree = options.hierarchy ? buildTaskTree(sorted) : undefined;
  const { children, parentOf } = buildForest(sorted, options.hierarchy, tree);
  const fromParentId = parentOf.get(task.id) ?? null;

  if (!options.hierarchy && move.toParentId !== fromParentId) {
    return "reparent-disabled";
  }

  if (options.hierarchy && move.toParentId) {
    const subtree = new Set(collectSubtreeIds(sorted, task.id, tree));
    if (subtree.has(move.toParentId)) return "cycle";
  }

  const siblings = children.get(fromParentId ?? ROOT) ?? [];
  const fromIndex = siblings.indexOf(task.id);
  if (
    move.toParentId === fromParentId &&
    clampIndex(move.toIndex, siblings.length - 1) === fromIndex
  ) {
    return "no-op";
  }

  return null;
}

/** Applies a move, renumbering every `sequence` from the row order that results; null when `validateMove` refuses it. See https://gantt.jaeungkim.com/docs/ref/core-tree */
export function moveTask(
  tasks: Task[],
  move: GanttTaskMove,
  options: GanttMoveOptions
): {
  /** Every task in input order; unchanged ones keep their identity, and only the moved task's `parentId` can change. */
  tasks: Task[];
  /** The move as applied. */
  change: GanttTaskMoveChange;
} | null {
  if (validateMove(tasks, move, options)) return null;

  const sorted = sortTasksBySequence(tasks);
  const { children, parentOf } = buildForest(sorted, options.hierarchy);
  const fromParentId = parentOf.get(move.taskId) ?? null;

  const fromKey = fromParentId ?? ROOT;
  const toKey = move.toParentId ?? ROOT;

  const fromSiblings = children.get(fromKey) ?? [];
  const fromIndex = fromSiblings.indexOf(move.taskId);
  fromSiblings.splice(fromIndex, 1);

  const toSiblings = children.get(toKey) ?? [];
  const toIndex = clampIndex(move.toIndex, toSiblings.length);
  toSiblings.splice(toIndex, 0, move.taskId);
  children.set(toKey, toSiblings);

  const sequenceOf = new Map<string, string>();
  const walk = (key: string, prefix: string) => {
    const ids = children.get(key) ?? [];
    ids.forEach((id, index) => {
      const sequence = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      sequenceOf.set(id, sequence);
      walk(id, sequence);
    });
  };
  walk(ROOT, "");

  const nextTasks = tasks.map((task) => {
    const sequence = sequenceOf.get(task.id) ?? task.sequence;
    const parentId =
      options.hierarchy && task.id === move.taskId
        ? move.toParentId
        : task.parentId;

    return sequence === task.sequence && parentId === task.parentId
      ? task
      : { ...task, sequence, parentId };
  });

  return {
    tasks: nextTasks,
    change: {
      taskId: move.taskId,
      fromParentId,
      fromIndex,
      toParentId: move.toParentId,
      toIndex,
      afterId: toSiblings[toIndex - 1] ?? null,
      beforeId: toSiblings[toIndex + 1] ?? null,
    },
  };
}
