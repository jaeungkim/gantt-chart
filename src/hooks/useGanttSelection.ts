import { useCallback } from "react";
import { useGanttStoreApi } from "stores/context";
import { TaskTransformed } from "types/task";

interface UseGanttSelectionParams {
  /** Undefined lets `onTaskSelect` decide whether clicking selects a row */
  selectable?: boolean;
  onTaskSelect?: (task: TaskTransformed | null) => void;
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
}

export interface GanttSelection {
  /** Selects a row, or clears the selection with null */
  select: (task: TaskTransformed | null) => void;
  onTaskClick: (task: TaskTransformed, event: React.MouseEvent) => void;
  onTaskDoubleClick: (task: TaskTransformed, event: React.MouseEvent) => void;
}

/**
 * Row selection, shared by the bars and the task list
 *
 * Both panes go through the one `select` below, so a bar and its grid row can never
 * disagree about what is selected. Like `showTaskList`/`columns`, passing the callback
 * is what turns the feature on unless `selectable` says otherwise.
 */
export function useGanttSelection({
  selectable,
  onTaskSelect,
  onTaskClick,
  onTaskDoubleClick,
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

  const handleDoubleClick = useCallback(
    (task: TaskTransformed, event: React.MouseEvent) => {
      onTaskDoubleClick?.(task, event);
    },
    [onTaskDoubleClick]
  );

  return {
    select,
    onTaskClick: handleClick,
    onTaskDoubleClick: handleDoubleClick,
  };
}
