import { RefObject, useRef, useState } from "react";
import { useGanttStoreApi } from "stores/context";
import { GanttReorderChange } from "types/gantt";
import { Task } from "types/task";
import {
  moveTaskInTree,
  resolveRowDropTarget,
  RowDropRow,
  RowDropTarget,
} from "utils/rowDrag";
import { sortTasksBySequence } from "utils/transformData";
import { buildTaskTree, collectSubtreeIds, TaskTree } from "utils/tree";

/** Pointer travel before a press on a row counts as a drag rather than a click (px) */
const DRAG_THRESHOLD = 3;

export interface RowDragState {
  draggedId: string;
  /** Where the drop would land - null while the pointer is nowhere useful */
  target: RowDropTarget | null;
}

interface DragContext {
  pointerId: number;
  draggedId: string;
  startX: number;
  startY: number;
  previousParentId: string | null;
  /** Snapshot taken once at pointerdown - the tree does not change mid-drag */
  tree: TaskTree;
  blockedIds: Set<string>;
  active: boolean;
  target: RowDropTarget | null;
}

interface UseGanttRowDragParams {
  /** The rows on screen, in row order */
  rows: RowDropRow[];
  /** The element the rows are positioned in - pointer Y is measured from its top */
  bodyRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onReorder?: (change: GanttReorderChange) => void | boolean;
  onTasksChange?: (updatedTasks: Task[]) => void;
}

function sameTarget(a: RowDropTarget | null, b: RowDropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.mode === b.mode &&
    a.rowIndex === b.rowIndex &&
    a.depth === b.depth &&
    a.parentId === b.parentId &&
    a.index === b.index &&
    a.valid === b.valid
  );
}

/**
 * Vertical drag of a grid row - reorders siblings and re-parents
 *
 * Deliberately separate from useGanttBarDrag: that one is horizontal and lives on the bars in
 * the timeline pane, this one is vertical and lives on the rows in the grid pane, so neither
 * gesture can start the other.
 *
 * Nothing is committed while the drop is illegal - the indicator says so during the drag and
 * the pointerup does nothing.
 */
export function useGanttRowDrag({
  rows,
  bodyRef,
  enabled,
  onReorder,
  onTasksChange,
}: UseGanttRowDragParams) {
  const storeApi = useGanttStoreApi();
  const [dragState, setDragState] = useState<RowDragState | null>(null);

  const contextRef = useRef<DragContext | null>(null);

  // The listeners below close over the props as they were at pointerdown. That is the whole
  // point: the rows cannot change while a pointer is held down on one of them.

  const onRowPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!enabled) return;
    // Only the primary pointer's left button starts a drag
    if (!e.isPrimary || e.button !== 0) return;
    if (contextRef.current) return;
    // The expander toggle (and anything else clickable in a cell) keeps its own click
    if ((e.target as HTMLElement).closest("button")) return;

    const draggedId = e.currentTarget.dataset.rowId;
    if (!draggedId) return;

    const sorted = sortTasksBySequence(storeApi.getState().rawTasks);
    const tree = buildTaskTree(sorted);
    if (!tree.parentOf.has(draggedId)) return;

    const ctx: DragContext = {
      pointerId: e.pointerId,
      draggedId,
      startX: e.clientX,
      startY: e.clientY,
      previousParentId:
        sorted.find((task) => task.id === draggedId)?.parentId ?? null,
      tree,
      blockedIds: new Set(collectSubtreeIds(sorted, draggedId, tree)),
      active: false,
      target: null,
    };
    contextRef.current = ctx;

    // Keeps the press from starting a text selection or the browser's native drag.
    // No setPointerCapture: the listeners below are on the document, so they already follow
    // the pointer out of the row, out of the pane and out of the window.
    e.preventDefault();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== ctx.pointerId) return;

      const deltaX = moveEvent.clientX - ctx.startX;
      const activating = !ctx.active;
      if (activating) {
        // A little slop so a plain click on a row is not a drag
        if (
          Math.abs(deltaX) < DRAG_THRESHOLD &&
          Math.abs(moveEvent.clientY - ctx.startY) < DRAG_THRESHOLD
        ) {
          return;
        }
        ctx.active = true;
      }

      const body = bodyRef.current;
      if (!body) return;

      const target = resolveRowDropTarget(rows, {
        draggedId: ctx.draggedId,
        offsetY: moveEvent.clientY - body.getBoundingClientRect().top,
        deltaX,
        tree: ctx.tree,
        blockedIds: ctx.blockedIds,
      });

      if (!activating && sameTarget(ctx.target, target)) return;
      ctx.target = target;
      setDragState({ draggedId: ctx.draggedId, target });
    };

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };

    const endDrag = () => {
      detachListeners();
      contextRef.current = null;
      setDragState(null);
    };

    // The browser cancelling the gesture (scroll takeover, multi-touch, ...) reverts
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== ctx.pointerId) return;
      endDrag();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== ctx.pointerId) return;

      const target = ctx.target;
      const wasActive = ctx.active;
      endDrag();

      if (!wasActive || !target || !target.valid) return;

      const rawTasks = storeApi.getState().rawTasks;
      const updatedTasks = moveTaskInTree(
        rawTasks,
        ctx.draggedId,
        target.parentId,
        target.index
      );
      // The same array back means the row was dropped where it already was
      if (updatedTasks === rawTasks) return;

      const task = updatedTasks.find((t) => t.id === ctx.draggedId);
      if (!task) return;

      // The host gets the last word before anything is committed
      const cancelled =
        onReorder?.({
          task,
          parentId: target.parentId,
          previousParentId: ctx.previousParentId,
          index: target.index,
          sequence: task.sequence,
          tasks: updatedTasks,
        }) === false;
      if (cancelled) return;

      // One commit for the whole reorder, so the renumbered rows undo together
      storeApi.getState().commitTasks(updatedTasks);
      onTasksChange?.(updatedTasks);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

  return { onRowPointerDown, dragState };
}
