import { useCallback } from "react";
import { useGanttStoreApi } from "shared/context";
import { TaskTransformed } from "shared/task";

interface UseGanttSelectionParams {
  // Undefined lets `onTaskSelect` decide whether clicking selects a row
  selectable?: boolean;
  onTaskSelect?: (task: TaskTransformed | null) => void;
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
}

interface GanttSelection {
  // Selects a row, or clears the selection with null
  select: (task: TaskTransformed | null) => void;
  onTaskClick: (task: TaskTransformed, event: React.MouseEvent) => void;
}

// Both panes go through the one `select`, so a bar and its grid row cannot disagree
export function useGanttSelection({
  selectable,
  onTaskSelect,
  onTaskClick,
}: UseGanttSelectionParams): GanttSelection {
  const storeApi = useGanttStoreApi();
  const enabled = selectable ?? onTaskSelect !== undefined;

  const select = useCallback(
    (task: TaskTransformed | null) => {
      if (!enabled) return;

      const nextId = task?.id ?? null;
      if (storeApi.getState().selectedTaskId === nextId) return;

      storeApi.getState().setSelectedTaskId(nextId);
      onTaskSelect?.(task);
    },
    [enabled, onTaskSelect, storeApi]
  );

  const handleClick = useCallback(
    (task: TaskTransformed, event: React.MouseEvent) => {
      onTaskClick?.(task, event);
      select(task);
    },
    [onTaskClick, select]
  );

  return {
    select,
    onTaskClick: handleClick,
  };
}
