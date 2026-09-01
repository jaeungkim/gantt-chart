import React, { useEffect, useRef, useState } from "react";
import { useGanttStoreApi } from "stores/context";
import { GanttBeforeChangeHandler } from "types/gantt";
import { normalizeProgress, Task, TaskTransformed } from "types/task";
import {
  buildTaskChange,
  mutationKey,
  REVERT_DURATION_MS,
} from "utils/mutation";
import { armPointerGesture, suppressTouchScroll } from "utils/pointerGesture";

export interface GanttProgressDragOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onBeforeTaskChange?: GanttBeforeChangeHandler;
}

/** The value on screen while the gesture runs, and after it while a veto is pending */
interface LiveProgress {
  percent: number;
  /** The pointer is up and the before-handler has not answered yet */
  pending: boolean;
}

/**
 * Progress handle drag hook
 * Previews with a local value while dragging, commits to rawTasks on pointerup
 */
export function useGanttProgressDrag(
  task: TaskTransformed,
  barRef: React.RefObject<HTMLDivElement | null>,
  options: GanttProgressDragOptions = {}
) {
  const storeApi = useGanttStoreApi();
  const [live, setLive] = useState<LiveProgress | null>(null);
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

  // The callbacks come from the render the gesture started in - a gesture is short enough
  // that a latest-ref would only add a stale-read hazard
  const { onTasksChange, onBeforeTaskChange } = options;

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Blocked so it does not overlap with the bar move drag
    e.stopPropagation();
    e.preventDefault();
    // A press that was given up to a scroll leaves its abort behind - clear it before
    // arming the next one, or the handle would never respond again
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const { pointerType } = e;

    // Same disambiguation as the bar: a touch has to rest on the handle first, so
    // scrolling past it does not rewrite the task's progress
    pendingGestureRef.current = armPointerGesture(
      {
        pointerType,
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
      },
      () => {
        pendingGestureRef.current = null;
        startDrag(pointerType);
      }
    );
  };

  const startDrag = (pointerType: string) => {
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    // A fresh gesture supersedes a veto still pending on this bar's progress
    let gateToken: number | null = null;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const percent = percentFromPointer(moveEvent.clientX);
      if (percent === null) return;

      if (gateToken === null) {
        gateToken = storeApi
          .getState()
          .mutationGate.begin(mutationKey("progress", task.id));
      }

      liveProgressRef.current = percent;
      setLive({ percent, pending: false });
    };

    const handlePointerUp = () => {
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

      const previous = storeApi.getState().rawTasks;
      const next = previous.map((t) =>
        t.id === task.id ? { ...t, progress: percent } : t
      );
      const change = buildTaskChange({
        type: "progress",
        taskId: task.id,
        changedIds: [task.id],
        previous,
        next,
      });

      const commit = () => {
        const edited = change.changedTasks[0];
        const merged = storeApi
          .getState()
          .rawTasks.map((t) => (t.id === edited?.id ? edited : t));

        // Recorded at commit time against the tasks the merge just read - a veto or a
        // superseded answer never gets here, so neither becomes an undo step
        storeApi.getState().commitTasks(merged);
        setLive(null);
        onTasksChange?.(merged);
      };

      // Nothing was written, so dropping the preview shows the stored progress again
      const rollback = () => {
        const state = storeApi.getState();
        state.beginRevert([task.id]);
        setLive(null);
        setTimeout(
          () => storeApi.getState().endRevert([task.id]),
          REVERT_DURATION_MS
        );
      };

      if (!onBeforeTaskChange || gateToken === null) {
        commit();
        return;
      }

      // The fill stays where the user let go while the handler runs
      setLive({ percent, pending: true });

      void storeApi
        .getState()
        .mutationGate.settle(
          mutationKey("progress", task.id),
          gateToken,
          onBeforeTaskChange,
          change
        )
        .then((outcome) => {
          if (outcome === "commit") commit();
          else if (outcome === "rollback") rollback();
          // 'stale' - a newer gesture owns this handle, so this answer is dropped
        });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  return {
    onProgressPointerDown: onPointerDown,
    progress: live?.percent ?? normalizeProgress(task.progress),
    isDraggingProgress: live !== null && !live.pending,
  };
}
