import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from "constants/gantt";
import { Dayjs } from "dayjs";
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs from "core/dates";
import { transformTasks } from "./transformData";
import { buildTaskTree, rollUpTasks } from "core/tree";

export interface TimelineData {
  bottomCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
}

export interface NonWorkingRange {
  left: number;
  width: number;
}

/**
 * How far the timeline origin moved, in px - the scrollLeft compensation
 *
 * The timeline range comes from the tasks' min/max dates, so dragging the
 * earliest task moves the origin as a whole and pushes every bar across the
 * screen. Adding this value to scrollLeft keeps the date you were looking at
 * in place.
 *
 * Positive when cells were added in front, negative when they were removed.
 */
export function originShiftPx(
  prevTicks: GanttBottomRowCell[],
  nextTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): number {
  if (!prevTicks.length || !nextTicks.length) return 0;

  const prevOrigin = prevTicks[0].startDate;
  const nextOrigin = nextTicks[0].startDate;
  const diff = prevOrigin.valueOf() - nextOrigin.valueOf();
  if (diff === 0) return 0;

  // The previous origin is later = cells were added in front (shift by where the previous origin sits in the new timeline)
  if (diff > 0) return calculateDateOffsetPx(prevOrigin, nextTicks, scaleKey) ?? 0;

  // The previous origin is earlier = leading cells disappeared
  return -(calculateDateOffsetPx(nextOrigin, prevTicks, scaleKey) ?? 0);
}

/**
 * Merges non-working (weekend/holiday) cells into px ranges
 * Only applies to scales whose tick unit is a day or finer
 */
export function computeNonWorkingRanges(
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey,
  isNonWorkingDay: (date: Dayjs) => boolean
): NonWorkingRange[] {
  const { tickUnit } = GANTT_SCALE_CONFIG[scaleKey];
  if (tickUnit !== "day" && tickUnit !== "hour") return [];

  const ranges: NonWorkingRange[] = [];
  let offset = 0;
  let prevNonWorking = false;

  for (const tick of timelineTicks) {
    const nonWorking = isNonWorkingDay(tick.startDate);
    if (nonWorking) {
      if (prevNonWorking) {
        ranges[ranges.length - 1].width += tick.widthPx;
      } else {
        ranges.push({ left: offset, width: tick.widthPx });
      }
    }
    prevNonWorking = nonWorking;
    offset += tick.widthPx;
  }

  return ranges;
}

/**
 * Moves a date by the given number of drag steps
 *
 * Adds the scale's drag unit (hour/day) as-is. Converting to minutes first
 * (day = 1440 minutes) drifts by an hour at a local-calendar DST boundary,
 * where a day is 23 or 25 hours, and tasks near midnight get committed to an
 * entirely different date cell.
 */
export function shiftByDragSteps(
  date: Dayjs,
  steps: number,
  scaleKey: GanttScaleKey
): Dayjs {
  const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[scaleKey];
  return date.add(steps * dragStepAmount, dragStepUnit);
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

  const config = GANTT_SCALE_CONFIG[scaleKey];
  const { tickUnit, unitPerTick } = config;

  let leftMargin = 0;
  let barWidth = 0;
  let hasStarted = false;

  const startTime = startDate.valueOf();
  const endTime = endDate.valueOf();

  for (const tick of timelineTicks) {
    const tickStart = tick.startDate;
    const tickEnd = tickStart.add(unitPerTick, tickUnit);
    const tickWidth = tick.widthPx;

    const tickStartTime = tickStart.valueOf();
    const tickEndTime = tickEnd.valueOf();

    // Skip ticks that fall before the task starts
    if (tickEndTime <= startTime) {
      leftMargin += tickWidth;
      continue;
    }

    // Stop once past the task's end
    if (tickStartTime >= endTime) {
      break;
    }

    // Compute the overlapping region
    const overlapStart = startTime > tickStartTime ? startDate : tickStart;
    const overlapEnd = endTime < tickEndTime ? endDate : tickEnd;

    const tickDuration = tickEndTime - tickStartTime;
    const overlapDuration = overlapEnd.valueOf() - overlapStart.valueOf();
    const overlapRatio = overlapDuration / tickDuration;

    // Add the partial width of the first overlapping tick
    if (!hasStarted && overlapStart.valueOf() > tickStartTime) {
      const beforeStartRatio =
        (overlapStart.valueOf() - tickStartTime) / tickDuration;
      leftMargin += beforeStartRatio * tickWidth;
    }

    barWidth += overlapRatio * tickWidth;
    hasStarted = true;
  }

  return {
    barMarginLeftAmount: leftMargin,
    barWidthSize: Math.max(barWidth, 1),
  };
}

/**
 * Computes the px offset of a given date along the timeline
 * Returns null when the date is outside the timeline range
 */
export function calculateDateOffsetPx(
  date: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): number | null {
  if (!timelineTicks.length) return null;

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  const time = date.valueOf();

  if (time < timelineTicks[0].startDate.valueOf()) return null;

  let offset = 0;
  for (const tick of timelineTicks) {
    const tickStart = tick.startDate.valueOf();
    const tickEnd = tick.startDate.add(unitPerTick, tickUnit).valueOf();

    if (time < tickEnd) {
      return offset + ((time - tickStart) / (tickEnd - tickStart)) * tick.widthPx;
    }
    offset += tick.widthPx;
  }

  return null;
}

function findDateRangeFromTasks(
  tasks: Task[]
): { minDate: Dayjs; maxDate: Dayjs } {
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const task of tasks) {
    const start = dayjs(task.startDate).valueOf();
    const end = dayjs(task.endDate).valueOf();

    if (!Number.isNaN(start)) minTime = Math.min(minTime, start);
    if (!Number.isNaN(end)) maxTime = Math.max(maxTime, end);
  }

  return {
    minDate: dayjs(minTime),
    maxDate: dayjs(maxTime),
  };
}

function padDateRange(
  minDate: Dayjs,
  maxDate: Dayjs,
  selectedScale: GanttScaleKey
): { paddedMinDate: Dayjs; paddedMaxDate: Dayjs } {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const { tickUnit, unitPerTick } = config;
  const bufferAmount = TIMELINE_SHIFT_BUFFER * unitPerTick;

  return {
    paddedMinDate: minDate.subtract(bufferAmount, tickUnit),
    paddedMaxDate: maxDate.add(bufferAmount, tickUnit),
  };
}

function createBottomRowCells(
  paddedMinDate: Dayjs,
  paddedMaxDate: Dayjs,
  selectedScale: GanttScaleKey
): GanttBottomRowCell[] {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const {
    tickUnit,
    unitPerTick,
    basePxPerDragStep,
    dragStepUnit,
    dragStepAmount,
  } = config;

  const cells: GanttBottomRowCell[] = [];
  let current = paddedMinDate.startOf(tickUnit);
  const maxTime = paddedMaxDate.valueOf();
  const dragStepRatio = basePxPerDragStep / dragStepAmount;

  while (current.valueOf() < maxTime) {
    const nextTick = current.add(unitPerTick, tickUnit);
    const tickDuration = nextTick.diff(current, dragStepUnit);
    const widthPx = tickDuration * dragStepRatio;

    cells.push({
      startDate: current,
      widthPx,
    });

    current = nextTick;
  }

  return cells;
}

/**
 * Builds the top header groups from the bottom cells
 * Used by the header component
 */
export function createTopHeaderGroups(
  bottomCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey
): GanttTopHeaderGroup[] {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const { labelUnit, formatHeaderLabel } = config;

  if (bottomCells.length === 0) return [];

  const groups: GanttTopHeaderGroup[] = [];
  let currentGroup: GanttTopHeaderGroup | null = null;

  for (const cell of bottomCells) {
    const start = cell.startDate.startOf(labelUnit);
    const key = start.valueOf();
    const label = formatHeaderLabel?.(start) ?? start.format();

    if (currentGroup && currentGroup.startDate.valueOf() === key) {
      currentGroup.widthPx += cell.widthPx;
    } else {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        label,
        widthPx: cell.widthPx,
        startDate: start,
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Computes the timeline data
 * Returns bottomCells and transformedTasks for the given rawTasks and scale
 *
 * With hierarchy on, a parentId tree is built and parents are recomputed as summary rows.
 * (Rolled up before the padding is computed so the dates derived from children also widen
 *  the timeline range)
 */
export function computeTimelineData(
  rawTasks: Task[],
  selectedScale: GanttScaleKey,
  hierarchy = false
): TimelineData {
  if (!rawTasks.length) {
    return { bottomCells: [], transformedTasks: [] };
  }

  const tree = hierarchy ? buildTaskTree(rawTasks) : undefined;
  const tasks = tree ? rollUpTasks(rawTasks, tree) : rawTasks;

  // Find the date range and add padding
  const { minDate, maxDate } = findDateRangeFromTasks(tasks);
  const { paddedMinDate, paddedMaxDate } = padDateRange(
    minDate,
    maxDate,
    selectedScale
  );

  // Build the timeline pieces
  const bottomCells = createBottomRowCells(
    paddedMinDate,
    paddedMaxDate,
    selectedScale
  );
  const transformedTasks = transformTasks(
    tasks,
    bottomCells,
    selectedScale,
    tree
  );

  return { bottomCells, transformedTasks };
}
