import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { isMilestoneTask, Task, TaskTransformed } from "types/task";
import dayjs from "core/dates";
import { calculateDateOffsets } from "./timeline";
import { TaskTree } from "core/tree";

// Helper function to parse sequence numbers
function parseSequence(sequence: string): number[] {
  return sequence.split(".").map(Number);
}

/**
 * Sort tasks by their sequence hierarchy
 *
 * Row order comes from this and nothing else - '1.10' lands after '1.2' because the
 * segments compare as numbers.
 */
export function sortTasksBySequence(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aParts = parseSequence(a.sequence);
    const bParts = parseSequence(b.sequence);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
}

// Calculate task depth from sequence
function calculateTaskDepth(sequence: string): number {
  return sequence.split(".").length - 1;
}

/**
 * @param tree the parentId tree (only when hierarchy is on) - given, depth comes from the
 *             parent chain instead of sequence, and rows with children are marked as summaries
 */
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

    // Calculate bar position and width
    // Milestones are a single point at startDate (endDate is ignored)
    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      dayjs(task.startDate),
      isMilestoneTask(task) ? dayjs(task.startDate) : dayjs(task.endDate),
      timelineTicks,
      selectedScale
    );

    // Baseline snapshot, when the task carries one - a milestone's is a single point
    const baseline = task.baselineStart
      ? calculateDateOffsets(
          dayjs(task.baselineStart),
          isMilestoneTask(task) || !task.baselineEnd
            ? dayjs(task.baselineStart)
            : dayjs(task.baselineEnd),
          timelineTicks,
          selectedScale
        )
      : null;

    return {
      ...task,
      barLeft: barMarginLeftAmount,
      barWidth: barWidthSize,
      baselineLeft: baseline?.barMarginLeftAmount,
      baselineWidth: baseline?.barWidthSize,
      depth,
      isSummary,
      order,
      originalOrder: order,
    };
  });
}
