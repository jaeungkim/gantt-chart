import { useMemo } from "react";
import { GanttGroupBy } from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { buildGanttRows, GanttRow } from "utils/grouping";
import { buildTaskTree, getVisibleTasks } from "core/tree";

interface UseGanttRowModelParams {
  /** The task data, as the parentId tree is built from it */
  rawTasks: Task[];
  /** The positioned rows to lay out - CPM metrics included */
  tasks: TaskTransformed[];
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  groupBy?: GanttGroupBy;
  ungroupedLabel?: string;
}

export interface GanttRowModel {
  /** What both panes render, in screen order */
  rows: GanttRow[];
  /** Every task on a row, flattened - what the dependency arrows are drawn between */
  tasks: TaskTransformed[];
  /**
   * The task id per row, aligned with `rows`
   *
   * null where the row owns no task, so a range drawn on a group header belongs to
   * no row and creates nothing.
   */
  rowIds: (string | null)[];
}

/**
 * Turns the task data into the rows on screen: hierarchy, then collapsing, then grouping
 *
 * The grid and the timeline read the one `rows` array, so their rows cannot drift
 * apart. Building it also rewrites every task's `order` to its row number, which is
 * what the dependency arrows position by.
 */
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

  const rowIds = useMemo(
    () => rows.map((row) => (row.group ? null : (row.tasks[0]?.id ?? null))),
    [rows]
  );

  return { rows, tasks: rowTasks, rowIds };
}
