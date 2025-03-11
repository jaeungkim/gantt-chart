import { Dayjs } from 'dayjs';
import {
  ganttScaleSettings,
  GanttTimelineGrid,
  GanttTimelineScale,
} from 'types/gantt';
import { generateCustomDateRange, shiftDate } from 'utils/date';
import dayjs from 'utils/dayjs';

const SHIFT_BUFFER = 2;

export function setupTimelineGrids(
  tasks: Record<string, { startDate: string; endDate: string }>,
  selectedScale: GanttTimelineScale,
  updateMinDate: (date: Dayjs) => void,
  updateMaxDate: (date: Dayjs) => void,
  updateTimelineGrids: (grids: GanttTimelineGrid[]) => void,
) {
  const { timeUnit, gridInterval, tickSettings } =
    ganttScaleSettings[selectedScale];

  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  const allTasks = Object.values(tasks);
  const todayTimestamp = dayjs().startOf('day').valueOf();

  for (const task of allTasks) {
    const start = dayjs(task.startDate).valueOf();
    const end = dayjs(task.endDate).valueOf();

    if (!Number.isNaN(start)) {
      minTimestamp = Math.min(minTimestamp, start);
    }
    if (!Number.isNaN(end)) {
      maxTimestamp = Math.max(maxTimestamp, end);
    }
  }

  if (minTimestamp === Infinity || maxTimestamp === -Infinity) {
    console.error('setupTimelineGrids: No valid start or end dates found.');
    return;
  }

  let minDate = dayjs(minTimestamp);
  let maxDate = dayjs(maxTimestamp);

  // Adjust to include today's date if outside the range.
  if (todayTimestamp < minTimestamp) {
    minDate = dayjs(todayTimestamp);
  }
  if (todayTimestamp > maxTimestamp) {
    maxDate = dayjs(todayTimestamp);
  }

  updateMinDate(minDate);
  updateMaxDate(maxDate);

  const paddedMinDate = shiftDate(
    minDate,
    timeUnit,
    SHIFT_BUFFER,
    gridInterval,
    'back',
  );
  const paddedMaxDate = shiftDate(
    maxDate,
    timeUnit,
    SHIFT_BUFFER,
    gridInterval,
    'forward',
  );

  const dateRange = generateCustomDateRange(
    timeUnit,
    gridInterval,
    paddedMinDate,
    paddedMaxDate,
  );

  const grids = dateRange.map((date) => {
    let gridWidthInRem: number;

    if (timeUnit === 'month') {
      const totalDays = Array.from({ length: gridInterval }, (_, i) =>
        dayjs(date)
          .add(i + 1, 'month')
          .date(0)
          .date(),
      ).reduce((sum, days) => sum + days, 0);

      gridWidthInRem = totalDays * tickSettings.widthPerIntervalRem;
    } else {
      gridWidthInRem = gridInterval * tickSettings.widthPerIntervalRem;
    }

    return { date, gridWidthInRem };
  });

  updateTimelineGrids(grids);
}

export interface DateOffsetResult {
  barMarginLeftAmount: number;
  barWidthSize: number;
}

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): DateOffsetResult {
  if (!timelineGrids.length) {
    console.warn('No timeline grids available to calculate offsets');
    return {
      barMarginLeftAmount: 0,
      barWidthSize: 0,
    };
  }

  const { tickSettings } = ganttScaleSettings[selectedScale];
  const tickWidthRem = tickSettings.widthPerIntervalRem;

  // The first grid date is the starting point for the timeline
  const chartStartDate = dayjs(timelineGrids[0].date);

  // Calculate the offset in days between the task start and the chart start
  const startOffsetDays = startDate.diff(chartStartDate, 'day');
  const endOffsetDays = endDate.diff(chartStartDate, 'day');

  // Calculate the left margin in rem based on startOffsetDays
  const barMarginLeftAmount = Math.max(startOffsetDays, 0) * tickWidthRem;

  // Calculate the width in rem based on duration (endOffset - startOffset + 1 to be inclusive)
  let barWidthSize =
    (Math.max(endOffsetDays - startOffsetDays, 0) + 1) * tickWidthRem;

  // Handle case where task starts and ends on the same day (width = tickWidthRem)
  if (startDate.isSame(endDate, 'day')) {
    barWidthSize = tickWidthRem;
  }

  return {
    barMarginLeftAmount,
    barWidthSize,
  };
}
