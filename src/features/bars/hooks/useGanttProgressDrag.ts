import React, { useEffect, useRef, useState } from "react";
import { useGanttStoreApi } from "shared/context";
import { normalizeProgress, Task, TaskTransformed } from "shared/task";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";

interface GanttProgressDragOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
}

// Previews with a local value while dragging, commits to rawTasks on pointerup
export function useGanttProgressDrag(
  task: TaskTransformed,
  barRef: React.RefObject<HTMLDivElement | null>,
  options: GanttProgressDragOptions = {}
) {
  const storeApi = useGanttStoreApi();
  const [live, setLive] = useState<number | null>(null);
  const liveProgressRef = useRef<number | null>(null);
  // Aborts a touch long press that has not started the drag yet
  const pendingGestureRef = useRef<(() => void) | null>(null);

  useEffect(() => () => pendingGestureRef.current?.(), []);

  const percentFromPointer = (clientX: number): number | null => {
    const bar = barRef.current;
    if (!bar) return null;

    const rect = bar.getBoundingClientRect();
    if (rect.width === 0) return null;

    const ratio = (clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  };

  // Bound to the render the gesture started in - a latest-ref would only add a stale-read hazard
  const { onTasksChange } = options;

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    // Blocked so it does not overlap with the bar move drag
    e.stopPropagation();
    e.preventDefault();
    // A press given up to a scroll leaves its abort behind - clear it or the handle dies
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const { pointerId, pointerType } = e;

    // Same disambiguation as the bar: a touch has to rest on the handle first
    pendingGestureRef.current = armPointerGesture(
      {
        pointerType,
        pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
      },
      () => {
        pendingGestureRef.current = null;
        startDrag(pointerId, pointerType);
      }
    );
  };

  const startDrag = (pointerId: number, pointerType: string) => {
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const percent = percentFromPointer(moveEvent.clientX);
      if (percent === null) return;

      liveProgressRef.current = percent;
      setLive(percent);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      releaseTouchScroll?.();

      const percent = liveProgressRef.current;
      liveProgressRef.current = null;

      if (percent === null) {
        setLive(null);
        return;
      }

      const merged = storeApi
        .getState()
        .rawTasks.map((t) =>
          t.id === task.id ? { ...t, progress: percent } : t
        );

      storeApi.getState().setRawTasks(merged);
      setLive(null);
      onTasksChange?.(merged);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  return {
    onProgressPointerDown: onPointerDown,
    progress: live ?? normalizeProgress(task.progress),
    isDraggingProgress: live !== null,
  };
}
