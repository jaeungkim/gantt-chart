import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from 'constants/gantt';
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
  scaleKey: GanttScaleKey,
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) return { barMarginLeftAmount: 0, barWidthSize: 0 };

  const config = GANTT_SCALE_CONFIG[scaleKey];
  console.log('config', config);
  const paddedTickStart = timelineTicks[0].startDate;

  // Shift to logical chartStart (excluding padding)
  const chartStartDate = paddedTickStart.add(
    TIMELINE_SHIFT_BUFFER * config.unitPerTick,
    config.tickUnit,
  );

  const offsetStart =
    startDate.diff(chartStartDate, config.dragStepUnit, true) /
    config.dragStepAmount;

  const offsetEnd =
    endDate.diff(chartStartDate, config.dragStepUnit, true) /
    config.dragStepAmount;

  const pxPerStep = config.basePxPerDragStep;
  const barMarginLeftAmount = offsetStart * pxPerStep;
  const barWidthSize = Math.max(offsetEnd - offsetStart, 1) * pxPerStep;

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
