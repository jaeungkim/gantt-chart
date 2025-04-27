import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { Dayjs } from 'dayjs';
import { GanttBottomRowCell, GanttScaleKey } from 'types/gantt';
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

/* ms values for quick math */
const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const UNIT_TO_MS = {
  minute: MS_MIN,
  hour: MS_HOUR,
  day: MS_DAY,
} as const;

export function alignToScaleBoundary(
  d: Dayjs,
  scale: GanttScaleKey,
  dir: 'floor' | 'ceil' = 'floor',
): Dayjs {
  const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[scale];

  /* day-based grids were already correct */
  if (dragStepUnit === 'day') {
    return dir === 'floor'
      ? d.startOf('day')
      : d.startOf('day').add(dragStepAmount, 'day');
  }

  /* minute / hour grid */
  const stepMs = dragStepAmount * UNIT_TO_MS[dragStepUnit];
  const t       = d.millisecond(0).valueOf();
  const offset  = d.utcOffset() * 60_000;          // +540 → 32 400 000 ms

  const snapped =
    dir === 'floor'
      ? Math.floor((t - offset) / stepMs) * stepMs + offset
      : Math.ceil ((t - offset) / stepMs) * stepMs + offset;

  return dayjs(snapped);   // returned in LOCAL zone
}

export function transformTasks(
  tasks: Task[],
  timelineTicks: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);
  let orderCounter = 0;

  return sortedTasks.map((task) => {
    orderCounter++;
    const depth = calculateTaskDepth(task.sequence);

    const alignedStart = alignToScaleBoundary(
      dayjs(task.startDate),
      selectedScale,
      'floor',
    );

    const alignedEnd = alignToScaleBoundary(
      dayjs(task.endDate),
      selectedScale,
      'ceil',
    );

    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      alignedStart,
      alignedEnd,
      timelineTicks,
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
