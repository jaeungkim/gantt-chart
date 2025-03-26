import { GanttTimelineGrid, GanttTimelineScale } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { calculateDateOffsets } from './timeline';

function sortTasksBySequence(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aParts = a.sequence.split('.').map(Number);
    const bParts = b.sequence.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }

    return 0;
  });
}

function calculateTaskDepth(sequence: string): number {
  return sequence.split('.').length - 1;
}

export function transformTasks(
  tasks: Task[],
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);
  let orderCounter = 0;

  return sortedTasks.map((task) => {
    orderCounter++;
    const depth = calculateTaskDepth(task.sequence);

    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      dayjs(task.startDate),
      dayjs(task.endDate),
      timelineGrids,
      selectedScale,
    );

    return {
      ...task,
      barLeft: barMarginLeftAmount,
      barWidth: barWidthSize,
      depth,
      order: orderCounter,
      originalOrder: orderCounter,
    };
  });
}
