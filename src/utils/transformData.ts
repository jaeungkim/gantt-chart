import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { calculateDateOffsets } from "./timeline";

// Helper function to parse sequence numbers
function parseSequence(sequence: string): number[] {
  return sequence.split(".").map(Number);
}

// Sort tasks by their sequence hierarchy
function sortTasksBySequence(tasks: Task[]): Task[] {
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

export function transformTasks(
  tasks: Task[],
  timelineTicks: GanttBottomRowCell[],
  selectedScale: GanttScaleKey
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);

  return sortedTasks.map((task, index) => {
    const depth = calculateTaskDepth(task.sequence);
    const order = index + 1;

    // Calculate bar position and width
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
      order,
      originalOrder: order,
    };
  });
}
