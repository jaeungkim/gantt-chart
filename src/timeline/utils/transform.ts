import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import { calculateDateOffsets } from "./geometry";
import { TaskTree } from "core/tree";
import { sortTasksBySequence } from "core/reorder";

function calculateTaskDepth(sequence: string): number {
  return sequence.split(".").length - 1;
}

// With `tree` (hierarchy on) depth comes from the parent chain, not the sequence, and rows
// with children are marked as summaries.
export function transformTasks(
  tasks: Task[],
  timelineTicks: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  tree?: TaskTree
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);

  return sortedTasks.map((task, index) => {
    const depth = tree
      ? tree.depthOf.get(task.id) ?? 0
      : calculateTaskDepth(task.sequence);
    const isSummary = (tree?.childIds.get(task.id)?.length ?? 0) > 0;
    const order = index + 1;

    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      dayjs(task.startDate),
      dayjs(task.endDate),
      timelineTicks,
      selectedScale
    );

    return {
      ...task,
      barLeft: barMarginLeftAmount,
      barWidth: barWidthSize,
      depth,
      isSummary,
      order,
      originalOrder: order,
    };
  });
}
