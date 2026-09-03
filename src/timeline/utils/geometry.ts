import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from "shared/constants";
import { Dayjs } from "dayjs";
import {
  GanttBottomRowCell,
  GanttDateRange,
  GanttDragBounds,
  GanttDragMode,
  GanttLabelUnit,
  GanttLocaleOptions,
  GanttRangeExtension,
  GanttScaleKey,
  GanttTopHeaderGroup,
  GanttVisibleRange,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import dayjs, { startOfQuarter, startOfWeek } from "core/dates";
import { resolveFormatters, resolveLabelUnit } from "shared/utils/i18n";
import { NO_RANGE_EXTENSION } from "timeline/utils/viewport";
import { transformTasks } from "./transform";
import { buildTaskTree, rollUpTasks } from "core/tree";

interface TimelineData {
  bottomCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
}

export interface NonWorkingRange {
  left: number;
  width: number;
}

// How far the timeline origin moved, in px - add to scrollLeft to keep the viewed date in place.
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

  // Previous origin later = cells were added in front
  if (diff > 0) return calculateDateOffsetPx(prevOrigin, nextTicks, scaleKey) ?? 0;

  // Previous origin earlier = leading cells disappeared
  return -(calculateDateOffsetPx(nextOrigin, prevTicks, scaleKey) ?? 0);
}

// Merges non-working cells into px ranges. Day and hour tick units only.
export function computeNonWorkingRanges(
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey,
  isNonWorkingDay: (date: Dayjs) => boolean
): NonWorkingRange[] {
  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  if (tickUnit !== "day" && tickUnit !== "hour") return [];

  // An hour-unit cell never straddles midnight, so only day-unit cells are split
  const daysPerTick = tickUnit === "day" ? unitPerTick : 1;

  const ranges: NonWorkingRange[] = [];
  let offset = 0;
  let prevNonWorking = false;

  for (const tick of timelineTicks) {
    const dayWidth = tick.widthPx / daysPerTick;

    for (let day = 0; day < daysPerTick; day++) {
      const nonWorking = isNonWorkingDay(tick.startDate.add(day, "day"));
      if (nonWorking) {
        if (prevNonWorking) {
          ranges[ranges.length - 1].width += dayWidth;
        } else {
          ranges.push({ left: offset + day * dayWidth, width: dayWidth });
        }
      }
      prevNonWorking = nonWorking;
    }

    offset += tick.widthPx;
  }

  return ranges;
}

// Moves a date by N drag steps. Adds the scale's unit as-is - via minutes it drifts an hour at DST.
export function shiftByDragSteps(
  date: Dayjs,
  steps: number,
  scaleKey: GanttScaleKey
): Dayjs {
  const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[scaleKey];
  return date.add(steps * dragStepAmount, dragStepUnit);
}

// Distance between two dates in px at the scale's drag resolution; inverse of shiftByDragSteps.
export function pxBetweenDates(
  from: Dayjs,
  to: Dayjs,
  scaleKey: GanttScaleKey
): number {
  const { dragStepUnit, dragStepAmount, basePxPerDragStep } =
    GANTT_SCALE_CONFIG[scaleKey];
  return (to.diff(from, dragStepUnit, true) / dragStepAmount) * basePxPerDragStep;
}

// Clamps a dragged bar into its window; "bar" keeps its length (min wins), an edge stays >= 1 step.
export function clampDragDates(
  mode: GanttDragMode,
  startDate: Dayjs,
  endDate: Dayjs,
  bounds: GanttDragBounds,
  scaleKey: GanttScaleKey
): { startDate: Dayjs; endDate: Dayjs } {
  const { min, max } = bounds;
  if (!min && !max) return { startDate, endDate };

  if (mode === "bar") {
    let start = startDate;
    let end = endDate;

    if (max && end.valueOf() > max.valueOf()) {
      const overshoot = end.valueOf() - max.valueOf();
      start = start.subtract(overshoot, "millisecond");
      end = max;
    }
    if (min && start.valueOf() < min.valueOf()) {
      const overshoot = min.valueOf() - start.valueOf();
      start = min;
      end = end.add(overshoot, "millisecond");
    }

    return { startDate: start, endDate: end };
  }

  if (mode === "left") {
    let start = startDate;
    if (min && start.valueOf() < min.valueOf()) start = min;
    if (max && start.valueOf() > max.valueOf()) start = max;

    const latestStart = shiftByDragSteps(endDate, -1, scaleKey);
    if (start.valueOf() > latestStart.valueOf()) start = latestStart;

    return { startDate: start, endDate };
  }

  let end = endDate;
  if (max && end.valueOf() > max.valueOf()) end = max;
  if (min && end.valueOf() < min.valueOf()) end = min;

  const earliestEnd = shiftByDragSteps(startDate, 1, scaleKey);
  if (end.valueOf() < earliestEnd.valueOf()) end = earliestEnd;

  return { startDate, endDate: end };
}

// Largest shared move keeping every member inside its own window; stays between 0 and requestedMs.
export function clampMoveDelta(
  members: { start: Dayjs; end: Dayjs; bounds: GanttDragBounds }[],
  requestedMs: number,
  scaleKey: GanttScaleKey
): number {
  const lo = Math.min(0, requestedMs);
  const hi = Math.max(0, requestedMs);

  let delta = requestedMs;
  for (const member of members) {
    const { startDate } = clampDragDates(
      "bar",
      member.start.add(requestedMs, "millisecond"),
      member.end.add(requestedMs, "millisecond"),
      member.bounds,
      scaleKey
    );
    const allowed = Math.min(
      hi,
      Math.max(lo, startDate.valueOf() - member.start.valueOf())
    );
    if (Math.abs(allowed) < Math.abs(delta)) delta = allowed;
  }

  return delta;
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

    if (tickEndTime <= startTime) {
      leftMargin += tickWidth;
      continue;
    }

    if (tickStartTime >= endTime) {
      break;
    }

    const overlapStart = startTime > tickStartTime ? startDate : tickStart;
    const overlapEnd = endTime < tickEndTime ? endDate : tickEnd;

    const tickDuration = tickEndTime - tickStartTime;
    const overlapDuration = overlapEnd.valueOf() - overlapStart.valueOf();
    const overlapRatio = overlapDuration / tickDuration;

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

// Px offset of a date along the timeline; null when the date is outside the range.
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

// Date at a px offset - inverse of calculateDateOffsetPx; null when outside the rendered range.
export function dateAtOffsetPx(
  offsetPx: number,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): Dayjs | null {
  if (!timelineTicks.length || offsetPx < 0) return null;

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];

  let offset = 0;
  for (const tick of timelineTicks) {
    if (offsetPx < offset + tick.widthPx) {
      const startMs = tick.startDate.valueOf();
      const tickMs = tick.startDate.add(unitPerTick, tickUnit).valueOf() - startMs;
      const ratio = tick.widthPx > 0 ? (offsetPx - offset) / tick.widthPx : 0;
      return dayjs(startMs + ratio * tickMs);
    }
    offset += tick.widthPx;
  }

  return null;
}

// First and last moment the rendered ticks cover; null for an empty timeline.
export function timelineRange(
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): GanttDateRange | null {
  if (!timelineTicks.length) return null;

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  const last = timelineTicks[timelineTicks.length - 1];

  return {
    start: timelineTicks[0].startDate,
    end: last.startDate.add(unitPerTick, tickUnit),
  };
}

// Index of the tick a px offset falls in, clamped to the timeline.
function tickIndexAt(
  px: number,
  timelineTicks: GanttBottomRowCell[]
): number {
  if (px <= 0) return 0;

  let offset = 0;
  for (let index = 0; index < timelineTicks.length; index++) {
    offset += timelineTicks[index].widthPx;
    if (px < offset) return index;
  }

  return timelineTicks.length - 1;
}

interface DrawnRange {
  startDate: Dayjs;
  endDate: Dayjs;
  // px box of the snapped range - the ghost bar
  leftPx: number;
  widthPx: number;
}

// Snaps a drawn px range (from the timeline's left edge) outwards to whole ticks, min one tick wide.
export function snapDrawnRange(
  startPx: number,
  endPx: number,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): DrawnRange | null {
  if (!timelineTicks.length) return null;

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  const firstTick = tickIndexAt(Math.min(startPx, endPx), timelineTicks);
  const lastTick = tickIndexAt(Math.max(startPx, endPx), timelineTicks);

  let leftPx = 0;
  for (let index = 0; index < firstTick; index++) {
    leftPx += timelineTicks[index].widthPx;
  }

  let widthPx = 0;
  for (let index = firstTick; index <= lastTick; index++) {
    widthPx += timelineTicks[index].widthPx;
  }

  return {
    startDate: timelineTicks[firstTick].startDate,
    endDate: timelineTicks[lastTick].startDate.add(unitPerTick, tickUnit),
    leftPx,
    widthPx,
  };
}

function findDateRangeFromTasks(
  tasks: Task[]
): { minDate: Dayjs; maxDate: Dayjs } {
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const task of tasks) {
    const start = task.startDate ? dayjs(task.startDate).valueOf() : NaN;
    if (!Number.isNaN(start)) minTime = Math.min(minTime, start);

    const end = task.endDate ? dayjs(task.endDate).valueOf() : NaN;
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
  selectedScale: GanttScaleKey,
  extension: GanttRangeExtension
): { paddedMinDate: Dayjs; paddedMaxDate: Dayjs } {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const { tickUnit, unitPerTick } = config;
  const bufferAmount = TIMELINE_SHIFT_BUFFER * unitPerTick;

  return {
    paddedMinDate: minDate.subtract(
      bufferAmount + extension.before * unitPerTick,
      tickUnit
    ),
    paddedMaxDate: maxDate.add(
      bufferAmount + extension.after * unitPerTick,
      tickUnit
    ),
  };
}

function createBottomRowCells(
  rangeStart: Dayjs,
  rangeEnd: Dayjs,
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
  // A multi-tick cell must open on the boundary it is named after, else week columns start midweek
  let current = config.tickAlign
    ? groupStartDate(rangeStart, config.tickAlign)
    : rangeStart.startOf(tickUnit);
  const maxTime = rangeEnd.valueOf();
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

// First moment of the group a cell belongs to; 'quarter'/'week' are not dayjs units - see core/dates.
function groupStartDate(
  date: Dayjs,
  labelUnit: GanttLabelUnit,
  firstDayOfWeek?: number
): Dayjs {
  if (labelUnit === "quarter") return startOfQuarter(date);
  if (labelUnit === "week") return startOfWeek(date, firstDayOfWeek);
  return date.startOf(labelUnit);
}

export function createTopHeaderGroups(
  bottomCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  localeOptions?: GanttLocaleOptions
): GanttTopHeaderGroup[] {
  const labelUnit = resolveLabelUnit(selectedScale, localeOptions);
  const { header } = resolveFormatters(selectedScale, localeOptions);

  if (bottomCells.length === 0) return [];

  const groups: GanttTopHeaderGroup[] = [];
  let currentGroup: GanttTopHeaderGroup | null = null;

  for (const cell of bottomCells) {
    const start = groupStartDate(
      cell.startDate,
      labelUnit,
      localeOptions?.firstDayOfWeek
    );
    const key = start.valueOf();
    const label = header(start);

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

// Builds bottomCells + transformedTasks. A pinned `visibleRange` edge is used verbatim; an open one
// auto-fits to the rolled-up task dates, buffered and widened by `extension`.
export function computeTimelineData(
  rawTasks: Task[],
  selectedScale: GanttScaleKey,
  visibleRange?: GanttVisibleRange,
  hierarchy = false,
  extension: GanttRangeExtension = NO_RANGE_EXTENSION
): TimelineData {
  const fixedStart = visibleRange?.start;
  const fixedEnd = visibleRange?.end;

  // Without tasks there is nothing to fit to, so only a fully pinned window can be drawn
  if (!rawTasks.length && !(fixedStart && fixedEnd)) {
    return { bottomCells: [], transformedTasks: [] };
  }

  const tree = hierarchy ? buildTaskTree(rawTasks) : undefined;
  const tasks = tree ? rollUpTasks(rawTasks, tree) : rawTasks;

  let rangeStart = fixedStart;
  let rangeEnd = fixedEnd;

  if (!rangeStart || !rangeEnd) {
    const { minDate, maxDate } = findDateRangeFromTasks(tasks);
    const { paddedMinDate, paddedMaxDate } = padDateRange(
      minDate,
      maxDate,
      selectedScale,
      extension
    );
    rangeStart = rangeStart ?? paddedMinDate;
    rangeEnd = rangeEnd ?? paddedMaxDate;
  }

  const bottomCells = createBottomRowCells(
    rangeStart,
    rangeEnd,
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
