import React, { useEffect, useRef, useState } from "react";
import { useGanttStoreApi } from "stores/context";
import { normalizeProgress, Task, TaskTransformed } from "types/task";
import { armPointerGesture, suppressTouchScroll } from "utils/pointerGesture";

/**
 * Progress handle drag hook
 * Previews with a local value while dragging, commits to rawTasks on pointerup
 */
export function useGanttProgressDrag(
  task: TaskTransformed,
  barRef: React.RefObject<HTMLDivElement | null>,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const storeApi = useGanttStoreApi();
  const [liveProgress, setLiveProgress] = useState<number | null>(null);
  const liveProgressRef = useRef<number | null>(null);
  /** Aborts a touch long press that has not started the drag yet */
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

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Blocked so it does not overlap with the bar move drag
    e.stopPropagation();
    e.preventDefault();
    // A press that was given up to a scroll leaves its abort behind - clear it before
    // arming the next one, or the handle would never respond again
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    // Same disambiguation as the bar: a touch has to rest on the handle first, so
    // scrolling past it does not rewrite the task's progress
    pendingGestureRef.current = armPointerGesture(
      {
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
      },
      () => {
        pendingGestureRef.current = null;
        startDrag(e.pointerType);
      }
    );
  };

  const startDrag = (pointerType: string) => {
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const percent = percentFromPointer(moveEvent.clientX);
      if (percent === null) return;

      liveProgressRef.current = percent;
      setLiveProgress(percent);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
      releaseTouchScroll?.();

      const percent = liveProgressRef.current;
      liveProgressRef.current = null;
      setLiveProgress(null);

      if (percent === null) return;

      const updatedTasks = storeApi
        .getState()
        .rawTasks.map((t) =>
          t.id === task.id ? { ...t, progress: percent } : t
        );

      storeApi.getState().commitTasks(updatedTasks);
      onTasksChange?.(updatedTasks);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  return {
    onProgressPointerDown: onPointerDown,
    progress: liveProgress ?? normalizeProgress(task.progress),
    isDraggingProgress: liveProgress !== null,
  };
}
