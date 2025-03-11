import {
  GanttTimelineGrid,
  GanttTimelineScale,
  Task,
  TaskTransformed,
} from 'types/gantt';
import dayjs from 'utils/dayjs';
import { calculateDateOffsets } from './timeline';
// Function to transform tasks based on timeline grids
export function transformTasks(
  tasks: Task[],
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): TaskTransformed[] {
  // First, sort tasks based on sequence (e.g. "1", "2", "2.1", "2.2", etc.)
  const sortedTasks = [...tasks].sort((a, b) => {
    const aParts = a.sequence.split('.').map(Number);
    const bParts = b.sequence.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });

  // setuptimelineGrids

  // Assign order and originalOrder as incremental numbers
  let orderCounter = 0;

  return sortedTasks.map((task) => {
    // Calculate depth from sequence (e.g., "2" -> depth 0, "2.1" -> depth 1, "2.1.2" -> depth 2)
    const depth = task.sequence.split('.').length - 1;
    orderCounter++;
    const originalOrder = orderCounter;

    // Calculate bar offsets using the provided calculateDateOffsets function.
    // Here we assume that the task's startDate and endDate are valid ISO date strings.
    const start = dayjs(task.startDate);
    const end = dayjs(task.endDate);
    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      start,
      end,
      timelineGrids,
      selectedScale,
    );

    return {
      ...task,
      barLeftMargin: barMarginLeftAmount,
      barWidth: barWidthSize,
      depth,
      order: orderCounter,
      originalOrder,
    };
  });
}
