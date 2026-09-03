import { useCallback, useMemo } from "react";
import {
  GanttMoveOptions,
  GanttMoveRejection,
  GanttTaskMove,
  GanttTaskMoveChange,
  moveTask,
  validateMove,
} from "core/reorder";
import { useGanttStoreApi } from "shared/context";
import { GanttGroupBy } from "shared/types";
import { GanttInteractionConfig, resolveTaskInteraction, Task } from "shared/task";
import { groupKeyOf } from "rows/utils/grouping";

interface UseGanttTaskMoveParams {
  hierarchy: boolean;
  interaction: GanttInteractionConfig;
  groupBy?: GanttGroupBy;
  collapsedIds: ReadonlySet<string>;
  onTasksChange?: (tasks: Task[]) => void;
  onTaskMove?: (change: GanttTaskMoveChange) => boolean | void;
  // Expands a collapsed drop target, so the row that just landed in it is visible
  onExpand?: (rowId: string) => void;
}

export interface GanttTaskMoveApi {
  // Whether a move would be refused, and why - runs on every frame of a row drag
  validate: (move: GanttTaskMove) => GanttMoveRejection | null;
  // Applies a move, reporting whether it was committed
  apply: (move: GanttTaskMove) => boolean;
}

// The one place a task move is validated and committed - both the row drag and the keyboard
// bindings route through it. `onTaskMove` runs first and can veto.
export function useGanttTaskMove({
  hierarchy,
  interaction,
  groupBy,
  collapsedIds,
  onTasksChange,
  onTaskMove,
  onExpand,
}: UseGanttTaskMoveParams): GanttTaskMoveApi {
  const storeApi = useGanttStoreApi();

  // `groupBy` reads a transformed task, so the key is looked up by id, not recomputed
  const options = useMemo<GanttMoveOptions>(() => {
    const groupOf = groupBy
      ? (task: Task) => {
          const transformed = storeApi
            .getState()
            .transformedTasks.find((candidate) => candidate.id === task.id);
          return transformed ? groupKeyOf(transformed, groupBy) : "";
        }
      : undefined;

    return {
      hierarchy,
      canReorder: (task: Task) =>
        resolveTaskInteraction(task, interaction).canReorder,
      groupOf,
    };
  }, [hierarchy, interaction, groupBy, storeApi]);

  const validate = useCallback(
    (move: GanttTaskMove) =>
      validateMove(storeApi.getState().rawTasks, move, options),
    [storeApi, options]
  );

  const apply = useCallback(
    (move: GanttTaskMove) => {
      const result = moveTask(storeApi.getState().rawTasks, move, options);
      if (!result) return false;
      if (onTaskMove?.(result.change) === false) return false;

      storeApi.getState().setRawTasks(result.tasks);
      onTasksChange?.(result.tasks);

      // Dropping into a closed parent would otherwise look like the row disappeared
      if (move.toParentId && collapsedIds.has(move.toParentId)) {
        onExpand?.(move.toParentId);
      }
      return true;
    },
    [storeApi, options, onTaskMove, onTasksChange, collapsedIds, onExpand]
  );

  return { validate, apply };
}
