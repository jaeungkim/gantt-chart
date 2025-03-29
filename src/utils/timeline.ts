import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from 'constants/gantt';
import dayjs, { Dayjs } from 'dayjs';
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey,
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) {
    return { barMarginLeftAmount: 0, barWidthSize: 0 };
  }

  // Destructure the relevant config values
  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];

  // Calculate total chart width in pixels
  const totalPx = timelineTicks.reduce((sum, tick) => sum + tick.widthPx, 0);

  // Identify the earliest tick start and the latest tick start
  const chartStartDate = timelineTicks[0].startDate;
  const lastTickStartDate = timelineTicks[timelineTicks.length - 1].startDate;

  // Calculate total chart duration in milliseconds
  const totalDurationMs = dayjs(lastTickStartDate)
    .add(unitPerTick, tickUnit)
    .diff(chartStartDate);

  // Determine how many pixels correspond to one millisecond
  const pxPerMs = totalPx / totalDurationMs;

  // Calculate start/end offsets in milliseconds, then convert to pixels
  const startOffsetMs = startDate.diff(chartStartDate);
  const endOffsetMs = endDate.diff(chartStartDate);

  const barMarginLeftAmount = startOffsetMs * pxPerMs;
  // Ensure the width is at least 1 pixel if start/end are the same
  const barWidthSize = Math.max(endOffsetMs - startOffsetMs, 1) * pxPerMs;

  return { barMarginLeftAmount, barWidthSize };
}

export function findDateRangeFromTasks(
  tasks: Record<string, { startDate: string; endDate: string }>,
): { minDate: Dayjs; maxDate: Dayjs } {
  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  for (const { startDate, endDate } of Object.values(tasks)) {
    const start = dayjs(startDate).valueOf();
    const end = dayjs(endDate).valueOf();
    if (!Number.isNaN(start)) minTimestamp = Math.min(minTimestamp, start);
    if (!Number.isNaN(end)) maxTimestamp = Math.max(maxTimestamp, end);
  }

  return { minDate: dayjs(minTimestamp), maxDate: dayjs(maxTimestamp) };
}

export function padDateRange(
  minDate: Dayjs,
  maxDate: Dayjs,
  selectedScale: GanttScaleKey,
): { paddedMinDate: Dayjs; paddedMaxDate: Dayjs } {
  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[selectedScale];
  return {
    paddedMinDate: minDate.subtract(
      TIMELINE_SHIFT_BUFFER * unitPerTick,
      tickUnit,
    ),
    paddedMaxDate: maxDate.add(TIMELINE_SHIFT_BUFFER * unitPerTick, tickUnit),
  };
}

export function createBottomRowCells(
  paddedMinDate: Dayjs,
  paddedMaxDate: Dayjs,
  selectedScale: GanttScaleKey,
): GanttBottomRowCell[] {
  const { tickUnit, unitPerTick, basePxPerDragStep, dragStepUnit, dragStepAmount } =
    GANTT_SCALE_CONFIG[selectedScale];

  const cells: GanttBottomRowCell[] = [];
  let current = paddedMinDate.startOf(tickUnit);

  while (current.isBefore(paddedMaxDate)) {
    // How many drag steps fit in this tick?
    const tickDurationInDragSteps = dayjs(current).add(unitPerTick, tickUnit).diff(current, dragStepUnit) / dragStepAmount;

    cells.push({
      startDate: current,
      widthPx: tickDurationInDragSteps * basePxPerDragStep,
    });

    current = current.add(unitPerTick, tickUnit);
  }

  return cells;
}

export function createTopHeaderGroups(
  bottomCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
): GanttTopHeaderGroup[] {
  const { labelUnit, formatHeaderLabel } = GANTT_SCALE_CONFIG[selectedScale];
  const groups: GanttTopHeaderGroup[] = [];

  let currentKey: number | null = null;
  let currentLabel = '';
  let currentWidth = 0;
  let currentStart: dayjs.Dayjs | null = null;

  bottomCells.forEach((cell, i) => {
    const start = cell.startDate.startOf(labelUnit);
    const key = start.valueOf(); // ✅ use timestamp instead of formatted string
    const label = formatHeaderLabel?.(start) ?? start.format();

    if (key === currentKey) {
      currentWidth += cell.widthPx;
    } else {
      if (currentKey !== null) {
        groups.push({
          label: currentLabel,
          widthPx: currentWidth,
          startDate: currentStart!,
        });
      }
      currentKey = key;
      currentLabel = label;
      currentWidth = cell.widthPx;
      currentStart = start;
    }

    // Last cell
    if (i === bottomCells.length - 1) {
      groups.push({
        label: currentLabel,
        widthPx: currentWidth,
        startDate: currentStart!,
      });
    }
  });

  return groups;
}



export function setupTimelineStructure(
  tasks: Record<string, { startDate: string; endDate: string }>,
  selectedScale: GanttScaleKey,
  updateMinDate: (date: Dayjs) => void,
  updateMaxDate: (date: Dayjs) => void,
  updateBottomCells: (cells: GanttBottomRowCell[]) => void,
  updateHeaderGroups: (groups: GanttTopHeaderGroup[]) => void,
) {
  const { minDate, maxDate } = findDateRangeFromTasks(tasks);
  updateMinDate(minDate);
  updateMaxDate(maxDate);

  const { paddedMinDate, paddedMaxDate } = padDateRange(
    minDate,
    maxDate,
    selectedScale,
  );

  const bottomCells = createBottomRowCells(
    paddedMinDate,
    paddedMaxDate,
    selectedScale,
  );
  const headerGroups = createTopHeaderGroups(bottomCells, selectedScale);

  updateBottomCells(bottomCells);
  updateHeaderGroups(headerGroups);
}
