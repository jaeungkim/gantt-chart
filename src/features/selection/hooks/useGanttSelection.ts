import { useCallback, useLayoutEffect } from "react";
import { useGanttStoreApi } from "shared/context";
import { TaskTransformed } from "shared/task";

interface UseGanttSelectionParams {
  // Undefined lets `onTaskSelect` decide whether clicking selects a row
  selectable?: boolean;
  onTaskSelect?: (task: TaskTransformed | null) => void;
}

// Both panes go through the one `select`, so a bar and its grid row cannot disagree
export function useGanttSelection({
  selectable,
  onTaskSelect,
}: UseGanttSelectionParams) {
  const storeApi = useGanttStoreApi();
  const enabled = selectable ?? onTaskSelect !== undefined;

  // Clears before paint, and silently: onTaskSelect never fires while selection is off
  useLayoutEffect(() => {
    if (!enabled) storeApi.getState().setSelectedTaskId(null);
  }, [enabled, storeApi]);

  // Selects a row, or clears the selection with null
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
