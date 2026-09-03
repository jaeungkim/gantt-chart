import type { VirtualItem } from "shared/virtual/window";
import { RefObject, useEffect, useRef } from "react";
import { buildTaskOrder, GanttDropMode, moveForDrop } from "core/reorder";
import { GanttTaskMoveApi } from "task-list/hooks/useGanttTaskMove";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import { GanttReorderDraft } from "shared/store";
import { GanttRow } from "rows/utils/grouping";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";

interface UseGanttRowDragParams {
  rows: GanttRow[];
  // The rendered window - a row scrolled out of it cannot be a drop target
  virtualItems: VirtualItem[];
  bodyRef: RefObject<HTMLDivElement | null>;
  hierarchy: boolean;
  move: GanttTaskMoveApi;
}

// How much of a row's height counts as "drop above it" / "drop below it"
const EDGE_BAND = 0.25;

// Drops are resolved by arithmetic on the virtual items, not DOM hit-testing: the rows are
// absolutely positioned and anything painted over one would swallow the drop. Every frame
// publishes a draft carrying the move and the core's rejection, so a blocked drop can show.
export function useGanttRowDrag({
  rows,
  virtualItems,
  bodyRef,
  hierarchy,
  move,
}: UseGanttRowDragParams) {
  const storeApi = useGanttStoreApi();
  const draft = useGanttStore((store) => store.reorderDraft);
  // The listeners outlive the render that attached them, and a mid-drag scroll rewrites the window
  const rowsRef = useLatestRef(rows);
  const virtualItemsRef = useLatestRef(virtualItems);
  const moveRef = useLatestRef(move);
  // Aborts a touch long press that has not lifted yet
  const pendingRef = useRef<(() => void) | null>(null);
  // Tears down the running drag - also on unmount, so a culled row leaves no listeners or draft
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      pendingRef.current?.();
      cleanupRef.current?.();
    },
    []
  );

  const startDrag = (
    taskId: string,
    pointerId: number,
    pointerType: string,
    element: HTMLElement
  ) => {
    // Nothing commits until the release, so the sibling lists are read once, not per frame
    const order = buildTaskOrder(storeApi.getState().rawTasks, hierarchy);

    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Pointer already gone; pointerup/pointercancel below still tear the drag down
    }

    // Rows let touch scroll the pane, so the scroll is held off by hand for this drag
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const resolveDrop = (clientY: number): GanttReorderDraft | null => {
      const body = bodyRef.current;
      if (!body) return null;

      // The body scrolls with its container, so its own rect already carries the scroll
      const y = clientY - body.getBoundingClientRect().top;
      const item = virtualItemsRef.current.find(
        (candidate) =>
          y >= candidate.start && y < candidate.start + candidate.size
      );
      if (!item) return null;

      const row = rowsRef.current[item.index];
      const target = row?.tasks[0];
      // A group header owns no task, and a lane row owns several - neither names a slot
      if (!row || !target || row.group || row.tasks.length > 1) return null;

      const offset = (y - item.start) / item.size;
      const mode: GanttDropMode =
        offset < EDGE_BAND
          ? "before"
          : offset > 1 - EDGE_BAND
            ? "after"
            : "child";
      const candidate = moveForDrop(order, taskId, target.id, mode);

      return {
        taskId,
        rowIndex: item.index,
        mode,
        depth: mode === "child" ? row.depth + 1 : row.depth,
        move: candidate,
        rejection: moveRef.current.validate(candidate),
      };
    };

    // Where the pointer last was, so the release can re-read the row under it
    let lastClientY: number | null = null;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      lastClientY = moveEvent.clientY;
      storeApi.getState().setReorderDraft(resolveDrop(moveEvent.clientY));
    };

    const detachListeners = () => {
      releaseTouchScroll?.();
      document.body.style.cursor = previousCursor;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown);
      try {
        element.releasePointerCapture(pointerId);
      } catch {
        // Already released, or the grip is gone
      }
    };

    const cancelDrag = () => {
      detachListeners();
      cleanupRef.current = null;
      storeApi.getState().setReorderDraft(null);
    };

    // Browser-cancelled gestures (scroll takeover, multi-touch) drop the row
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cancelDrag();
    };

    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") cancelDrag();
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;

      // Resolved again, not read off the draft: a wheel scroll slides the rows under a
      // pointer that never moved, so the draft can name a row that is no longer there
      const dropped =
        lastClientY === null
          ? null
          : (resolveDrop(lastClientY) ?? storeApi.getState().reorderDraft);
      cancelDrag();

      if (dropped?.move && !dropped.rejection) {
        moveRef.current.apply(dropped.move);
      }
    }

    cleanupRef.current = cancelDrag;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);
  };

  const onGripPointerDown = (rowIndex: number, event: React.PointerEvent) => {
    // Same primary-pointer rule the bar drag uses
    if (!event.isPrimary || event.button !== 0) return;
    if (cleanupRef.current) return;
    // The primary pointer can only be down once, so anything still pending is stale
    pendingRef.current?.();
    pendingRef.current = null;

    const task = rowsRef.current[rowIndex]?.tasks[0];
    if (!task) return;

    // currentTarget is only valid while the React event is being dispatched
    const element = event.currentTarget as HTMLElement;
    const { pointerId, pointerType } = event;

    // A mouse press lifts the row now; a touch must rest first, so a swipe still scrolls
    pendingRef.current = armPointerGesture(
      { pointerType, pointerId, clientX: event.clientX, clientY: event.clientY },
      () => {
        pendingRef.current = null;
        startDrag(task.id, pointerId, pointerType, element);
      }
    );
  };

  return { onGripPointerDown, draft };
}
