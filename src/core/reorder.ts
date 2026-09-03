// Moving a task to a new parent or slot. Row order comes from `sequence`, a path ("2.1" is the
// first child of "2") that cannot be split, so a move renumbers instead of inserting a key.
// Structural validation only; whether a task may move at all arrives as `canReorder`.
import { Task } from "./types";
import { collectSubtreeIds } from "./tree";

/** Where a task is going: a parent, and a slot among that parent's children */
export interface GanttTaskMove {
  taskId: string;
  /** New parent, null for the root level */
  toParentId: string | null;
  /** Slot among the new parent's children, counted in the list as it stands after the move */
  toIndex: number;
}

/** The move that was applied - `toIndex` for an index-based API, `afterId`/`beforeId` for a position-based one */
export interface GanttTaskMoveChange extends GanttTaskMove {
  fromParentId: string | null;
  fromIndex: number;
  /** Sibling the task now follows - null when it is the first child */
  afterId: string | null;
  /** Sibling the task now precedes - null when it is the last child */
  beforeId: string | null;
}

/** Where a drop lands relative to the row under the pointer */
export type GanttDropMode = "before" | "after" | "child";

/** Why a move was refused - null from `validateMove` means it is allowed */
export type GanttMoveRejection =
  | "unknown-task"
  | "unknown-parent"
  | "read-only"
  | "cycle"
  | "reparent-disabled"
  | "no-op";

export interface GanttMoveOptions {
  /** Whether the parentId hierarchy is on - off, depth comes from `sequence` and a reparent is refused */
  hierarchy: boolean;
  /** Whether this task may be moved at all - left out, every task may */
  canReorder?: (task: Task) => boolean;
}

/** The sibling lists a move is measured against - `toIndex` is counted against exactly these */
interface TaskOrder {
  /** Normalized parent of each task - null for a root, an orphan or a cycle */
  parentOf: ReadonlyMap<string, string | null>;
  /** One parent's children in row order; pass null for the root list */
  childrenOf: (parentId: string | null) => readonly string[];
}

/** Splits "1.10" into [1, 10] so the segments compare as numbers, not as text */
function parseSequence(sequence: string): number[] {
  return sequence.split(".").map(Number);
}

/** Sort tasks by their sequence hierarchy - row order comes from this and nothing else */
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

/** The parent's id and the ordered sibling lists a move is applied to */
interface Forest {
  /** parent id (null key held as "") -> child ids, in row order */
  children: Map<string, string[]>;
  parentOf: Map<string, string | null>;
}

const ROOT = "";

// The ordered forest a move rearranges. `hierarchy` on, the parent link is `parentId` normalized
// like `buildTaskTree` does it; off, it is the sequence path ("2.1" hangs off whoever holds "2").
function buildForest(sorted: Task[], hierarchy: boolean): Forest {
  const parentOf = new Map<string, string | null>();
  const children = new Map<string, string[]>();

  if (hierarchy) {
    const byId = new Map(sorted.map((task) => [task.id, task]));
    for (const task of sorted) {
      const parentId = task.parentId;
      let resolved: string | null = null;

      if (parentId && parentId !== task.id && byId.has(parentId)) {
        // Walking up records every node, so a cycle is caught within n steps
        const seen = new Set([task.id]);
        let cursor: Task | undefined = byId.get(parentId);
        resolved = parentId;
        while (cursor) {
          if (seen.has(cursor.id)) {
            resolved = null;
            break;
          }
          seen.add(cursor.id);
          if (!cursor.parentId) break;
          cursor = byId.get(cursor.parentId);
        }
      }
      parentOf.set(task.id, resolved);
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
      // A prefix with no task of its own ("1.1" without a "1") has nothing to hang off
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

/** Reads the ordered forest the moves below are counted against */
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

/**
 * The move a drop on `targetId` would make: `before`/`after` make it a sibling, `child`
 * appends it. Says nothing about whether the move is allowed - that is `validateMove`.
 */
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

  // `toIndex` is counted after the dragged task is lifted out, so moving down its own list loses a slot
  const fromIndex = siblings.indexOf(taskId);

  return {
    taskId,
    toParentId,
    toIndex: fromIndex !== -1 && fromIndex < slot ? slot - 1 : slot,
  };
}

/** Whether a move can be applied, and why not when it cannot - runs on every frame of a row drag */
export function validateMove(
  tasks: Task[],
  move: GanttTaskMove,
  options: GanttMoveOptions
): GanttMoveRejection | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const task = byId.get(move.taskId);
  if (!task) return "unknown-task";

  const parent = move.toParentId ? byId.get(move.toParentId) : null;
  if (move.toParentId && !parent) return "unknown-parent";

  if (options.canReorder && !options.canReorder(task)) return "read-only";

  const sorted = sortTasksBySequence(tasks);
  const { children, parentOf } = buildForest(sorted, options.hierarchy);
  const fromParentId = parentOf.get(task.id) ?? null;

  if (!options.hierarchy && move.toParentId !== fromParentId) {
    return "reparent-disabled";
  }

  // A node cannot become its own descendant - the subtree is where it would land
  if (move.toParentId) {
    const subtree = new Set(collectSubtreeIds(sorted, task.id));
    if (subtree.has(move.toParentId)) return "cycle";
  }

  const siblings = children.get(fromParentId ?? ROOT) ?? [];
  const fromIndex = siblings.indexOf(task.id);
  if (move.toParentId === fromParentId && move.toIndex === fromIndex) {
    return "no-op";
  }

  return null;
}

/**
 * Applies a move, renumbering every sequence from the resulting row order; `parentId` is rewritten
 * on the moved task only. Null when refused (`validateMove` says why); unchanged tasks keep identity.
 */
export function moveTask(
  tasks: Task[],
  move: GanttTaskMove,
  options: GanttMoveOptions
): { tasks: Task[]; change: GanttTaskMoveChange } | null {
  if (validateMove(tasks, move, options)) return null;

  const sorted = sortTasksBySequence(tasks);
  const { children, parentOf } = buildForest(sorted, options.hierarchy);
  const fromParentId = parentOf.get(move.taskId) ?? null;

  const fromKey = fromParentId ?? ROOT;
  const toKey = move.toParentId ?? ROOT;

  const fromSiblings = [...(children.get(fromKey) ?? [])];
  const fromIndex = fromSiblings.indexOf(move.taskId);
  fromSiblings.splice(fromIndex, 1);
  children.set(fromKey, fromSiblings);

  const toSiblings =
    toKey === fromKey ? fromSiblings : [...(children.get(toKey) ?? [])];
  const toIndex = Math.min(Math.max(move.toIndex, 0), toSiblings.length);
  toSiblings.splice(toIndex, 0, move.taskId);
  children.set(toKey, toSiblings);

  // Depth-first in row order, so the path each task gets is the path it renders at
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
