import { useCallback, useLayoutEffect } from "react";
import { useGanttStoreApi } from "shared/context";
import { TaskTransformed } from "shared/task";

interface UseGanttSelectionParams {
  selectable?: boolean;
  onTaskSelect?: (task: TaskTransformed | null) => void;
}

export function useGanttSelection({
  selectable,
  onTaskSelect,
}: UseGanttSelectionParams) {
  const storeApi = useGanttStoreApi();
  const enabled = selectable ?? onTaskSelect !== undefined;

  useLayoutEffect(() => {
    if (!enabled) storeApi.getState().setSelectedTaskId(null);
  }, [enabled, storeApi]);

  return useCallback(
    (task: TaskTransformed | null) => {
      if (!enabled) return;

      const nextId = task?.id ?? null;
      if (storeApi.getState().selectedTaskId === nextId) return;

      storeApi.getState().setSelectedTaskId(nextId);
      onTaskSelect?.(task);
    },
    [enabled, onTaskSelect, storeApi]
  );
}
