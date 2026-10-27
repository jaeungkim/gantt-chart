import type { VirtualItem } from "shared/virtual/window";
import { RefObject, useEffect, useRef } from "react";
import { buildTaskOrder, GanttDropMode, moveForDrop } from "core/reorder";
import { GanttTaskMoveApi } from "features/task-list/types";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { HEADER_HEIGHT } from "shared/constants";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import { GanttReorderDraft } from "shared/store";
import { GanttRow } from "features/rows/utils/rows";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";

interface UseGanttRowDragParams {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  bodyRef: RefObject<HTMLDivElement | null>;
  hierarchy: boolean;
  move: GanttTaskMoveApi;
}

const EDGE_BAND = 0.25;

export function useGanttRowDrag({
  rows,
  virtualItems,
  bodyRef,
  hierarchy,
  move,
}: UseGanttRowDragParams) {
  const storeApi = useGanttStoreApi();
  const draft = useGanttStore((store) => store.reorderDraft);
  const rowsRef = useLatestRef(rows);
  const virtualItemsRef = useLatestRef(virtualItems);
  const moveRef = useLatestRef(move);
  const pendingRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const reorderedRef = useRef(false);

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
    const order = buildTaskOrder(storeApi.getState().rawTasks, hierarchy);

    try {
      element.setPointerCapture(pointerId);
    } catch {}

    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const scrollEl = bodyRef.current?.closest<HTMLElement>(
      ".gantt-scroll-container"
    );
    const inView = (clientY: number) => {
      if (!scrollEl) return true;
      const { top } = scrollEl.getBoundingClientRect();
      return (
        clientY >= top + HEADER_HEIGHT && clientY < top + scrollEl.clientHeight
      );
    };

    const resolveDrop = (clientY: number): GanttReorderDraft | null => {
      const body = bodyRef.current;
      if (!body || !inView(clientY)) return null;

      const y = clientY - body.getBoundingClientRect().top;
      const item = virtualItemsRef.current.find(
        (candidate) =>
          y >= candidate.start && y < candidate.start + candidate.size
      );
      if (!item) return null;

      const row = rowsRef.current[item.index];
      const target = row?.tasks[0];
      if (!row || !target || row.tasks.length > 1) return null;

      const offset = (y - item.start) / item.size;
      const mode = ((): GanttDropMode => {
        if (offset < EDGE_BAND) return "before";
        if (offset > 1 - EDGE_BAND) return "after";
        return "child";
      })();
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

    let lastClientY: number | null = null;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      lastClientY = moveEvent.clientY;
      storeApi.getState().setReorderDraft(resolveDrop(moveEvent.clientY));
    };

    const cancelDrag = () => {
      releaseTouchScroll?.();
      document.body.style.cursor = previousCursor;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown);
      try {
        element.releasePointerCapture(pointerId);
      } catch {}
      cleanupRef.current = null;
      storeApi.getState().setReorderDraft(null);
    };

    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cancelDrag();
    };

    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") cancelDrag();
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;

      const dropped =
        lastClientY === null || !inView(lastClientY)
          ? null
          : (resolveDrop(lastClientY) ?? storeApi.getState().reorderDraft);
      cancelDrag();

      if (dropped?.move && !dropped.rejection) {
        reorderedRef.current = true;
        setTimeout(() => {
          reorderedRef.current = false;
        });
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
    if (!event.isPrimary || event.button !== 0) return;
    if (cleanupRef.current) return;
    pendingRef.current?.();
    pendingRef.current = null;

    const task = rowsRef.current[rowIndex]?.tasks[0];
    if (!task) return;

    const element = event.currentTarget as HTMLElement;
    const { pointerId, pointerType } = event;

    pendingRef.current = armPointerGesture(
      { pointerType, pointerId, clientX: event.clientX, clientY: event.clientY },
      () => {
        pendingRef.current = null;
        startDrag(task.id, pointerId, pointerType, element);
      }
    );
  };

  const consumeDragClick = (): boolean => {
    if (!reorderedRef.current) return false;
    reorderedRef.current = false;
    return true;
  };

  return { onGripPointerDown, consumeDragClick, draft };
}
