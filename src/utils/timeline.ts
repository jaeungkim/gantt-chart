import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { Dayjs } from 'dayjs';
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';
import dayjs from 'utils/dayjs';

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineTicks: GanttBottomRowCell[],
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) return { barMarginLeftAmount: 0, barWidthSize: 0 };

  const chartStartDate = timelineTicks[0].startDate;

  const startOffsetDays = startDate.diff(chartStartDate, 'day', true);
  const endOffsetDays = endDate.diff(chartStartDate, 'day', true);

  const pxPerDay = getAveragePxPerDay(timelineTicks);

  const barMarginLeftAmount = startOffsetDays * pxPerDay;
  const barWidthSize = Math.max(endOffsetDays - startOffsetDays, 1) * pxPerDay;

  return {
    barMarginLeftAmount,
    barWidthSize,
  };
}

function getAveragePxPerDay(ticks: GanttBottomRowCell[]): number {
  if (ticks.length < 2) return 16;

  const dayDiff = ticks[1].startDate.diff(ticks[0].startDate, 'day', true);
  const pxDiff = ticks[1].widthPx;
  return pxDiff / dayDiff;
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

  if (minTimestamp === Infinity || maxTimestamp === -Infinity) {
    throw new Error('No valid start or end dates found.');
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
    paddedMinDate: minDate.subtract(unitPerTick, tickUnit),
    paddedMaxDate: maxDate.add(unitPerTick, tickUnit),
  };
}

export function createBottomRowCells(
  paddedMinDate: Dayjs,
  paddedMaxDate: Dayjs,
  selectedScale: GanttScaleKey,
): GanttBottomRowCell[] {
  const { dragStepUnit, dragStepAmount, basePxPerDragStep } =
    GANTT_SCALE_CONFIG[selectedScale];

  const cells: GanttBottomRowCell[] = [];
  let current = paddedMinDate.startOf(dragStepUnit);

  while (current.isBefore(paddedMaxDate)) {
    cells.push({
      startDate: current,
      widthPx: basePxPerDragStep,
    });
    current = current.add(dragStepAmount, dragStepUnit);
  }

  return cells;
}

export function createTopHeaderGroups(
  bottomCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
): GanttTopHeaderGroup[] {
  const { labelUnit, formatHeaderLabel } = GANTT_SCALE_CONFIG[selectedScale];

  const groups: GanttTopHeaderGroup[] = [];

  bottomCells.forEach((cell) => {
    const label =
      formatHeaderLabel?.(cell.startDate) ??
      cell.startDate.format('YYYY-MM-DD');

    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.widthPx += cell.widthPx;
    } else {
      groups.push({
        label,
        widthPx: cell.widthPx,
        startDate: cell.startDate,
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
