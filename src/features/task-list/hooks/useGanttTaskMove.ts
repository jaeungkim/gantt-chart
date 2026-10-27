import {
  GanttMoveOptions,
  GanttTaskMoveChange,
  moveTask,
  validateMove,
} from "core/reorder";
import { useGanttStoreApi } from "shared/context";
import { GanttInteractionConfig, resolveTaskInteraction, Task } from "shared/task";
import { GanttTaskMoveApi } from "features/task-list/types";

interface UseGanttTaskMoveParams {
  hierarchy: boolean;
  interaction: GanttInteractionConfig;
  onTasksChange?: (tasks: Task[]) => void;
  onTaskMove?: (change: GanttTaskMoveChange) => boolean | void;
  onExpand: (rowId: string) => void;
}

export function useGanttTaskMove({
  hierarchy,
  interaction,
  onTasksChange,
  onTaskMove,
  onExpand,
}: UseGanttTaskMoveParams): GanttTaskMoveApi {
  const storeApi = useGanttStoreApi();

  const options: GanttMoveOptions = {
    hierarchy,
    canReorder: (task) => resolveTaskInteraction(task, interaction).canReorder,
  };

  return {
    validate: (move) =>
      validateMove(storeApi.getState().rawTasks, move, options),
    apply: (move) => {
      const result = moveTask(storeApi.getState().rawTasks, move, options);
      if (!result || onTaskMove?.(result.change) === false) return;

      storeApi.getState().setRawTasks(result.tasks);
      onTasksChange?.(result.tasks);

      if (move.toParentId) onExpand(move.toParentId);
    },
  };
}
