import { NODE_HEIGHT, TREE_INDENT } from "constants/gantt";
import { Task } from "types/task";
import { sortTasksBySequence } from "./transformData";
import { buildTaskTree, collectSubtreeIds, TaskTree } from "./tree";

/**
 * Row reordering
 *
 * Row order comes from the dotted `sequence`, nesting from `parentId` - two independent
 * sources. A drop only has to change `parentId`, but leaving `sequence` alone would put the
 * row back where it was on the next sort. So a move renumbers `sequence` from the resulting
 * tree: it becomes a derived value (position among siblings, prefixed by the parent's
 * sequence) and the two sources can no longer disagree. That costs a new sequence on every
 * row after the move, which is the price of the round-trip through `onTasksChange` landing
 * where the user dropped it.
 *
 * Sibling order before a move still comes from `sequence`, so every tree here is built from
 * the sequence-sorted array - `childIds` and `rootIds` are then in row order.
 */

/** A row as the resolver sees it - TaskTransformed fits as-is */
export interface RowDropRow {
  id: string;
}

export interface RowDropTarget {
  /**
   * `"line"` - an insertion line drawn at the top edge of row `rowIndex`
   * (`rowIndex === rows.length` means below the last row).
   * `"into"` - row `rowIndex` is highlighted and becomes the new parent.
   */
  mode: "line" | "into";
  rowIndex: number;
  /** Tree depth the dragged row lands at - how far the indicator is indented */
  depth: number;
  /** The new parent (null = root) */
  parentId: string | null;
  /** Position among the new parent's children, counted after the row is detached */
  index: number;
  /** false when the drop would put the row inside its own subtree - never committed */
  valid: boolean;
}

export interface ResolveRowDropOptions {
  draggedId: string;
  /** Pointer Y measured from the top of the first row (px) */
  offsetY: number;
  /** Pointer X travel since the drag started (px) - positive indents, negative outdents */
  deltaX: number;
  /** Tree of the full task list, built from the sequence-sorted array */
  tree: TaskTree;
  /** The dragged subtree's ids - anything in here is an illegal parent */
  blockedIds: Set<string>;
  rowHeight?: number;
  indentWidth?: number;
}

/** Share of a row's height, top and bottom, that reads as "insert here" instead of "drop into" */
const EDGE_BAND = 0.3;

/**
 * Where a pointer at (offsetY, deltaX) would drop the dragged row
 *
 * `rows` are the rows actually on screen (collapsed subtrees already filtered out), in row
 * order. Returns null when the dragged row is not among them.
 */
export function resolveRowDropTarget(
  rows: RowDropRow[],
  options: ResolveRowDropOptions
): RowDropTarget | null {
  const {
    draggedId,
    offsetY,
    deltaX,
    tree,
    blockedIds,
    rowHeight = NODE_HEIGHT,
    indentWidth = TREE_INDENT,
  } = options;

  if (!rows.length || !rows.some((row) => row.id === draggedId)) return null;

  const depthOf = (id: string) => tree.depthOf.get(id) ?? 0;
  // The dragged row is about to leave its current slot, so it is not one of its own siblings
  const siblingsOf = (parentId: string | null) =>
    (parentId === null
      ? tree.rootIds
      : tree.childIds.get(parentId) ?? []
    ).filter((id) => id !== draggedId);

  // Which row the pointer is over, and how far down it
  const scaled = offsetY / rowHeight;
  const rowIndex = Math.min(rows.length - 1, Math.max(0, Math.floor(scaled)));
  const fraction = Math.min(1, Math.max(0, scaled - rowIndex));

  // The middle of a row means "drop into it"; the top and bottom edges mean "insert here"
  if (fraction > EDGE_BAND && fraction < 1 - EDGE_BAND) {
    const parentId = rows[rowIndex].id;
    return {
      mode: "into",
      rowIndex,
      depth: depthOf(parentId) + 1,
      parentId,
      index: siblingsOf(parentId).length,
      valid: !blockedIds.has(parentId),
    };
  }

  const gap = fraction < 0.5 ? rowIndex : rowIndex + 1;
  const prev = gap > 0 ? rows[gap - 1] : null;
  const next = gap < rows.length ? rows[gap] : null;

  // Outliner rule: the deepest a row can land is one level under the row above it, and it
  // cannot be shallower than the row below (that row would otherwise become its child)
  const maxDepth = prev ? depthOf(prev.id) + 1 : 0;
  const minDepth = Math.min(next ? depthOf(next.id) : 0, maxDepth);
  const depth = Math.min(
    maxDepth,
    Math.max(minDepth, depthOf(draggedId) + Math.round(deltaX / indentWidth))
  );

  // The new parent is the ancestor of the row above sitting at depth - 1
  let parentId: string | null = null;
  if (depth > 0 && prev) {
    let cursor: string | null = prev.id;
    for (let d = maxDepth - 1; cursor && d > depth - 1; d--) {
      cursor = tree.parentOf.get(cursor) ?? null;
    }
    parentId = cursor;
  }

  // Position among the new siblings: just after the nearest one visible above the gap
  const siblings = siblingsOf(parentId);
  let index = 0;
  for (let i = gap - 1; i >= 0; i--) {
    const position = siblings.indexOf(rows[i].id);
    if (position >= 0) {
      index = position + 1;
      break;
    }
  }

  return {
    mode: "line",
    rowIndex: gap,
    depth,
    parentId,
    index,
    valid: parentId === null || !blockedIds.has(parentId),
  };
}

/**
 * The task array with `moveId` re-parented to `parentId` at `index` among its new siblings
 *
 * Every `sequence` is rewritten from the resulting tree, so the dotted string and the parent
 * chain agree afterwards - the array survives a round-trip through `onTasksChange`.
 * `parentId` is only ever written on the moved task; a task whose parent link is an orphan or
 * a cycle keeps that link and is numbered as the root the tree already treats it as.
 *
 * Returns the input array unchanged when the move is unknown, illegal (the target is inside
 * the moved subtree) or a no-op.
 */
export function moveTaskInTree(
  tasks: Task[],
  moveId: string,
  parentId: string | null,
  index: number
): Task[] {
  const sorted = sortTasksBySequence(tasks);
  const tree = buildTaskTree(sorted);

  if (!tree.parentOf.has(moveId)) return tasks;
  if (parentId !== null) {
    if (!tree.parentOf.has(parentId)) return tasks;
    if (collectSubtreeIds(sorted, moveId, tree).includes(parentId)) return tasks;
  }

  // Working copies - the tree's own arrays stay untouched
  const rootIds = [...tree.rootIds];
  const childIds = new Map(
    [...tree.childIds].map(([id, children]) => [id, [...children]])
  );
  const listOf = (id: string | null): string[] => {
    if (id === null) return rootIds;

    let list = childIds.get(id);
    if (!list) {
      list = [];
      childIds.set(id, list);
    }
    return list;
  };

  const from = listOf(tree.parentOf.get(moveId) ?? null);
  from.splice(from.indexOf(moveId), 1);

  const to = listOf(parentId);
  to.splice(Math.min(Math.max(0, index), to.length), 0, moveId);

  // Renumber depth first: '1', '1.1', '1.2', '2', ... - the row order the sort will produce
  const sequenceOf = new Map<string, string>();
  const order: string[] = [];
  const walk = (ids: string[], prefix: string) => {
    ids.forEach((id, position) => {
      const sequence = prefix ? `${prefix}.${position + 1}` : `${position + 1}`;
      sequenceOf.set(id, sequence);
      order.push(id);
      walk(childIds.get(id) ?? [], sequence);
    });
  };
  walk(rootIds, "");

  const byId = new Map(sorted.map((task) => [task.id, task]));
  let changed = false;
  const moved = order.map((id) => {
    const task = byId.get(id) as Task;
    const sequence = sequenceOf.get(id) as string;
    const nextParentId = id === moveId ? parentId : task.parentId;

    if (task.sequence === sequence && task.parentId === nextParentId) {
      return task;
    }
    changed = true;
    return { ...task, sequence, parentId: nextParentId };
  });

  return changed ? moved : tasks;
}
