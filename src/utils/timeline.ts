import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from "constants/gantt";
import { Dayjs } from "dayjs";
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { transformTasks } from "./transformData";

// Cache for scale configurations to avoid repeated lookups
const scaleConfigCache = new Map<GanttScaleKey, any>();

function getScaleConfig(scaleKey: GanttScaleKey) {
  if (!scaleConfigCache.has(scaleKey)) {
    scaleConfigCache.set(scaleKey, GANTT_SCALE_CONFIG[scaleKey]);
  }
  return scaleConfigCache.get(scaleKey);
}

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) {
    return { barMarginLeftAmount: 0, barWidthSize: 0 };
  }

  const { tickUnit, unitPerTick } = getScaleConfig(scaleKey);

  let barMarginLeftAmount = 0;
  let barWidthSize = 0;
  let insideTask = false;

  // Pre-calculate start and end timestamps for faster comparison
  const startTimestamp = startDate.valueOf();
  const endTimestamp = endDate.valueOf();

  for (const tick of timelineTicks) {
    const tickStart = tick.startDate;
    const tickEnd = tickStart.add(unitPerTick, tickUnit);
    const tickWidth = tick.widthPx;

    const tickEndTimestamp = tickEnd.valueOf();
    const tickStartTimestamp = tickStart.valueOf();

    if (tickEndTimestamp <= startTimestamp) {
      barMarginLeftAmount += tickWidth;
      continue;
    }

    if (tickStartTimestamp >= endTimestamp) {
      break;
    }

    const overlapStart =
      startTimestamp > tickStartTimestamp ? startDate : tickStart;
    const overlapEnd = endTimestamp < tickEndTimestamp ? endDate : tickEnd;

    const tickDurationMs = tickEndTimestamp - tickStartTimestamp;
    const overlapDurationMs = overlapEnd.valueOf() - overlapStart.valueOf();

    const overlapRatio = overlapDurationMs / tickDurationMs;

    if (!insideTask && overlapStart.valueOf() > tickStartTimestamp) {
      const beforeStartRatio =
        (overlapStart.valueOf() - tickStartTimestamp) / tickDurationMs;
      barMarginLeftAmount += beforeStartRatio * tickWidth;
    }

    barWidthSize += overlapRatio * tickWidth;
    insideTask = true;
  }

  return {
    barMarginLeftAmount,
    barWidthSize: Math.max(barWidthSize, 1),
  };
}

export function findDateRangeFromTasks(
  tasks: Record<string, { startDate: string; endDate: string }>
): { minDate: Dayjs; maxDate: Dayjs } {
  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  // Use for...in for better performance with object iteration
  for (const taskId in tasks) {
    const { startDate, endDate } = tasks[taskId];
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
  selectedScale: GanttScaleKey
): { paddedMinDate: Dayjs; paddedMaxDate: Dayjs } {
  const { tickUnit, unitPerTick } = getScaleConfig(selectedScale);
  const bufferAmount = TIMELINE_SHIFT_BUFFER * unitPerTick;

  return {
    paddedMinDate: minDate.subtract(bufferAmount, tickUnit),
    paddedMaxDate: maxDate.add(bufferAmount, tickUnit),
  };
}

export function createBottomRowCells(
  paddedMinDate: Dayjs,
  paddedMaxDate: Dayjs,
  selectedScale: GanttScaleKey
): GanttBottomRowCell[] {
  const {
    tickUnit,
    unitPerTick,
    basePxPerDragStep,
    dragStepUnit,
    dragStepAmount,
  } = getScaleConfig(selectedScale);

  const cells: GanttBottomRowCell[] = [];
  let current = paddedMinDate.startOf(tickUnit);
  const maxDateValue = paddedMaxDate.valueOf();

  // Pre-calculate drag step ratio for better performance
  const dragStepRatio = basePxPerDragStep / dragStepAmount;

  while (current.valueOf() < maxDateValue) {
    const nextTick = current.add(unitPerTick, tickUnit);
    const tickDurationInDragSteps =
      nextTick.diff(current, dragStepUnit) * dragStepRatio;

    cells.push({
      startDate: current,
      widthPx: tickDurationInDragSteps,
    });

    current = nextTick;
  }

  return cells;
}

export function createTopHeaderGroups(
  bottomCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey
): GanttTopHeaderGroup[] {
  const { labelUnit, formatHeaderLabel } = getScaleConfig(selectedScale);

  const groups: GanttTopHeaderGroup[] = [];
  const cellCount = bottomCells.length;

  if (cellCount === 0) return groups;

  let currentKey: number | null = null;
  let currentLabel = "";
  let currentWidth = 0;
  let currentStart: Dayjs | null = null;

  for (let i = 0; i < cellCount; i++) {
    const cell = bottomCells[i];
    const start = cell.startDate.startOf(labelUnit);
    const key = start.valueOf();
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
  }

  // Add the last group
  if (currentKey !== null) {
    groups.push({
      label: currentLabel,
      widthPx: currentWidth,
      startDate: currentStart!,
    });
  }

  return groups;
}

export function setupTimelineStructure(
  rawTasks: Task[],
  selectedScale: GanttScaleKey,
  updateBottomCells: (cells: GanttBottomRowCell[]) => void,
  updateHeaderGroups: (groups: GanttTopHeaderGroup[]) => void,
  updateTransformedTasks: (transformed: TaskTransformed[]) => void
) {
  // Create task map more efficiently
  const taskMap = new Map<string, { startDate: string; endDate: string }>();
  for (const task of rawTasks) {
    taskMap.set(task.id, { startDate: task.startDate, endDate: task.endDate });
  }

  const { minDate, maxDate } = findDateRangeFromTasks(
    Object.fromEntries(taskMap)
  );
  const { paddedMinDate, paddedMaxDate } = padDateRange(
    minDate,
    maxDate,
    selectedScale
  );

  const bottomCells = createBottomRowCells(
    paddedMinDate,
    paddedMaxDate,
    selectedScale
  );
  const headerGroups = createTopHeaderGroups(bottomCells, selectedScale);
  const transformedTasks = transformTasks(rawTasks, bottomCells, selectedScale);

  // Batch updates to reduce re-renders
  updateBottomCells(bottomCells);
  updateHeaderGroups(headerGroups);
  updateTransformedTasks(transformedTasks);
}
