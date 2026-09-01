import React, { useRef, useState } from "react";
import { useGanttStoreApi } from "stores/context";
import { normalizeProgress, Task, TaskTransformed } from "types/task";

/**
 * 진행률 핸들 드래그 훅
 * 드래그 중에는 로컬 값으로 미리보기, pointerup 시 rawTasks에 커밋
 */
export function useGanttProgressDrag(
  task: TaskTransformed,
  barRef: React.RefObject<HTMLDivElement | null>,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const storeApi = useGanttStoreApi();
  const [liveProgress, setLiveProgress] = useState<number | null>(null);
  const liveProgressRef = useRef<number | null>(null);

  const percentFromPointer = (clientX: number): number | null => {
    const bar = barRef.current;
    if (!bar) return null;

    const rect = bar.getBoundingClientRect();
    if (rect.width === 0) return null;

    const ratio = (clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // 바 이동 드래그와 겹치지 않도록 차단
    e.stopPropagation();
    e.preventDefault();

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

      const percent = liveProgressRef.current;
      liveProgressRef.current = null;
      setLiveProgress(null);

      if (percent === null) return;

      const updatedTasks = storeApi
        .getState()
        .rawTasks.map((t) =>
          t.id === task.id ? { ...t, progress: percent } : t
        );

      storeApi.getState().setRawTasks(updatedTasks);
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
