import { useMemo } from "react";
import { Task, TaskTransformed } from "shared/task";
import { buildGanttRows, GanttRow } from "features/rows/utils/rows";
import { buildTaskTree, getVisibleTasks } from "core/tree";

interface UseGanttRowModelParams {
  rawTasks: Task[];
  tasks: TaskTransformed[];
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
}

interface GanttRowModel {
  rows: GanttRow[];
  tasks: TaskTransformed[];
}

export function useGanttRowModel({
  rawTasks,
  tasks,
  hierarchy,
  collapsedIds,
}: UseGanttRowModelParams): GanttRowModel {
  const tree = useMemo(
    () => (hierarchy ? buildTaskTree(rawTasks) : undefined),
    [hierarchy, rawTasks]
  );

  const visibleTasks = useMemo(() => {
    if (!hierarchy || !collapsedIds.size) return tasks;
    return getVisibleTasks(tasks, collapsedIds, tree);
  }, [hierarchy, collapsedIds, tasks, tree]);

  const rows = useMemo(() => buildGanttRows(visibleTasks), [visibleTasks]);

  const rowTasks = useMemo(() => rows.flatMap((row) => row.tasks), [rows]);

  return { rows, tasks: rowTasks };
}
