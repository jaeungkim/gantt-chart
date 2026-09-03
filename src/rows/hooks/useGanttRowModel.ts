import { useMemo } from "react";
import { GanttGroupBy } from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import { buildGanttRows, GanttRow } from "rows/utils/grouping";
import { buildTaskTree, getVisibleTasks } from "core/tree";

interface UseGanttRowModelParams {
  /** Raw data - the parentId tree is built from it */
  rawTasks: Task[];
  /** The positioned rows to lay out */
  tasks: TaskTransformed[];
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  groupBy?: GanttGroupBy;
  ungroupedLabel?: string;
}

interface GanttRowModel {
  /** What both panes render, in screen order */
  rows: GanttRow[];
  /** Every task on a row, flattened - what the dependency arrows are drawn between */
  tasks: TaskTransformed[];
}

/** The rows both panes render: hierarchy, then collapsing, then grouping */
export function useGanttRowModel({
  rawTasks,
  tasks,
  hierarchy,
  collapsedIds,
  groupBy,
  ungroupedLabel,
}: UseGanttRowModelParams): GanttRowModel {
  // Also what grouping reads a task's root ancestor from
  const tree = useMemo(
    () => (hierarchy ? buildTaskTree(rawTasks) : undefined),
    [hierarchy, rawTasks]
  );

  const visibleTasks = useMemo(() => {
    if (!hierarchy || !collapsedIds.size) return tasks;
    return getVisibleTasks(tasks, collapsedIds, tree);
  }, [hierarchy, collapsedIds, tasks, tree]);

  const rows = useMemo(
    () =>
      buildGanttRows(visibleTasks, {
        groupBy,
        collapsedIds,
        tree,
        ungroupedLabel,
      }),
    [visibleTasks, groupBy, collapsedIds, tree, ungroupedLabel]
  );

  const rowTasks = useMemo(() => rows.flatMap((row) => row.tasks), [rows]);

  return { rows, tasks: rowTasks };
}
