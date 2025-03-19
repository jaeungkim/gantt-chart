import { Dayjs } from 'dayjs';
import {
  ganttScaleSettings,
  GanttTimelineGrid,
  GanttTimelineScale,
} from 'types/gantt';
import { generateCustomDateRange, shiftDate } from 'utils/date';
import dayjs from 'utils/dayjs';

const SHIFT_BUFFER = 2;

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineGrids.length) {
    console.warn('calculateDateOffsets: No timeline grids available');
    return {
      barMarginLeftAmount: 0,
      barWidthSize: 0,
    };
  }

  const { tickSettings } = ganttScaleSettings[selectedScale];
  const tickWidthRem = tickSettings.widthPerIntervalRem;

  const chartStartDate = dayjs(timelineGrids[0].date);

  const startOffsetDays = startDate.diff(chartStartDate, 'day');
  const endOffsetDays = endDate.diff(chartStartDate, 'day');

  const barMarginLeftAmount = Math.max(startOffsetDays, 0) * tickWidthRem;

  let barWidthSize =
    (Math.max(endOffsetDays - startOffsetDays, 0) + 1) * tickWidthRem;

  // Handle single-day tasks explicitly (just for clarity)
  if (startDate.isSame(endDate, 'day')) {
    barWidthSize = tickWidthRem;
  }

  return {
    barMarginLeftAmount,
    barWidthSize,
  };
}

/** Returns the earliest start and latest end date of all tasks */
export function findDateRangeFromTasks(
  tasks: Record<string, { startDate: string; endDate: string }>,
): { minDate: Dayjs; maxDate: Dayjs } {
  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  const todayTimestamp = dayjs().startOf('day').valueOf();

  for (const { startDate, endDate } of Object.values(tasks)) {
    const start = dayjs(startDate).valueOf();
    const end = dayjs(endDate).valueOf();

    if (!Number.isNaN(start)) minTimestamp = Math.min(minTimestamp, start);
    if (!Number.isNaN(end)) maxTimestamp = Math.max(maxTimestamp, end);
  }

  if (minTimestamp === Infinity || maxTimestamp === -Infinity) {
    throw new Error('No valid start or end dates found.');
  }

  let minDate = dayjs(minTimestamp);
  let maxDate = dayjs(maxTimestamp);

  // Adjust for today
  if (todayTimestamp < minTimestamp) minDate = dayjs(todayTimestamp);
  if (todayTimestamp > maxTimestamp) maxDate = dayjs(todayTimestamp);

  return { minDate, maxDate };
}

/** Pads the min and max dates by SHIFT_BUFFER depending on the selected scale */
export function padDateRange(
  minDate: Dayjs,
  maxDate: Dayjs,
  selectedScale: GanttTimelineScale,
): { paddedMinDate: Dayjs; paddedMaxDate: Dayjs } {
  const { timeUnit, gridInterval } = ganttScaleSettings[selectedScale];

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

  return { paddedMinDate, paddedMaxDate };
}

/** Generates the timeline grids given the date range and scale */
export function createTimelineGrids(
  paddedMinDate: Dayjs,
  paddedMaxDate: Dayjs,
  selectedScale: GanttTimelineScale,
): GanttTimelineGrid[] {
  const { timeUnit, gridInterval, tickSettings } =
    ganttScaleSettings[selectedScale];

  const dateRange = generateCustomDateRange(
    timeUnit,
    gridInterval,
    paddedMinDate,
    paddedMaxDate,
  );

  return dateRange.map((date) => {
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
}

/** The orchestrator */
export function setupTimelineGrids(
  tasks: Record<string, { startDate: string; endDate: string }>,
  selectedScale: GanttTimelineScale,
  updateMinDate: (date: Dayjs) => void,
  updateMaxDate: (date: Dayjs) => void,
  updateTimelineGrids: (grids: GanttTimelineGrid[]) => void,
) {
  try {
    const { minDate, maxDate } = findDateRangeFromTasks(tasks);
    updateMinDate(minDate);
    updateMaxDate(maxDate);

    const { paddedMinDate, paddedMaxDate } = padDateRange(
      minDate,
      maxDate,
      selectedScale,
    );
    const grids = createTimelineGrids(
      paddedMinDate,
      paddedMaxDate,
      selectedScale,
    );

    updateTimelineGrids(grids);
  } catch (error) {
    console.error('setupTimelineGrids:', error);
  }
}
