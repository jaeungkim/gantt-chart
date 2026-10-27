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
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import dayjs, { startOfQuarter, startOfWeek } from "core/dates";
import { resolveFormatters, resolveLabelUnit } from "shared/utils/i18n";
import { NO_RANGE_EXTENSION } from "features/timeline/utils/viewport";
import { tickAxis, tickCellAt } from "./tickAxis";
import { transformTasks } from "./transform";
import { buildTaskTree, rollUpTasks } from "core/tree";

interface TimelineData {
  bottomCells: GanttBottomRowCell[];
  transformedTasks: TaskTransformed[];
}

export const OFF_DAY_KEY = "off";

export interface NonWorkingDay {
  key: string;
  label?: string;
  color?: string;
}

export interface NonWorkingRange {
  left: number;
  width: number;
  label?: string;
  color?: string;
}

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

  if (diff > 0) return calculateDateOffsetPx(prevOrigin, nextTicks, scaleKey) ?? 0;

  return -(calculateDateOffsetPx(nextOrigin, prevTicks, scaleKey) ?? 0);
}

export function computeNonWorkingRanges(
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey,
  nonWorkingDayAt: (date: Dayjs) => NonWorkingDay | null
): NonWorkingRange[] {
  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  if (tickUnit !== "day" && tickUnit !== "hour") return [];

  const daysPerTick = tickUnit === "day" ? unitPerTick : 1;

  const ranges: NonWorkingRange[] = [];
  let offset = 0;
  let prevKey: string | null = null;

  for (const tick of timelineTicks) {
    const dayWidth = tick.widthPx / daysPerTick;

    for (let day = 0; day < daysPerTick; day++) {
      const nonWorking = nonWorkingDayAt(tick.startDate.add(day, "day"));
      if (nonWorking) {
        if (nonWorking.key === prevKey) {
          ranges[ranges.length - 1].width += dayWidth;
        } else {
          ranges.push({
            left: offset + day * dayWidth,
            width: dayWidth,
            ...(nonWorking.label !== undefined && { label: nonWorking.label }),
            ...(nonWorking.color !== undefined && { color: nonWorking.color }),
          });
        }
      }
      prevKey = nonWorking?.key ?? null;
    }

    offset += tick.widthPx;
  }

  return ranges;
}

export function shiftByDragSteps(
  date: Dayjs,
  steps: number,
  scaleKey: GanttScaleKey
): Dayjs {
  const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[scaleKey];
  return date.add(steps * dragStepAmount, dragStepUnit);
}

export function pxBetweenDates(
  from: Dayjs,
  to: Dayjs,
  scaleKey: GanttScaleKey
): number {
  const { dragStepUnit, dragStepAmount, basePxPerDragStep } =
    GANTT_SCALE_CONFIG[scaleKey];
  return (to.diff(from, dragStepUnit, true) / dragStepAmount) * basePxPerDragStep;
}

export function toDragBounds(
  min: string | undefined,
  max: string | undefined
): GanttDragBounds | null {
  if (!min && !max) return null;
  return { min: min ? dayjs(min) : undefined, max: max ? dayjs(max) : undefined };
}

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

interface MoveMember {
  start: Dayjs;
  end: Dayjs;
  bounds: GanttDragBounds;
}

export function collectMoveMembers(
  rawTasks: Task[],
  movingIds: Set<string>,
  target: TaskTransformed,
  bounds: GanttDragBounds | null,
  interaction?: GanttInteractionConfig
): MoveMember[] {
  const members: MoveMember[] = [];

  for (const task of rawTasks) {
    if (!movingIds.has(task.id)) continue;

    const isTarget = task.id === target.id;
    const member = resolveTaskInteraction(task, interaction);
    const own = isTarget ? bounds : toDragBounds(member.minDate, member.maxDate);
    if (!own) continue;

    members.push({
      start: dayjs(isTarget ? target.startDate : task.startDate),
      end: dayjs(isTarget ? target.endDate : task.endDate),
      bounds: own,
    });
  }

  return members;
}

export function clampMoveDelta(
  members: MoveMember[],
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

interface DrawnRange {
  startDate: Dayjs;
  endDate: Dayjs;
  leftPx: number;
  widthPx: number;
}

export function snapDrawnRange(
  startPx: number,
  endPx: number,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): DrawnRange | null {
  if (!timelineTicks.length) return null;

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];
  const axis = tickAxis(timelineTicks);
  const first = tickCellAt(axis, Math.min(startPx, endPx));
  const last = tickCellAt(axis, Math.max(startPx, endPx));
  if (!first || !last) return null;

  return {
    startDate: timelineTicks[first.index].startDate,
    endDate: timelineTicks[last.index].startDate.add(unitPerTick, tickUnit),
    leftPx: first.left,
    widthPx: last.left + last.width - first.left,
  };
}

export function findDateRangeFromTasks(
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

  const groups: GanttTopHeaderGroup[] = [];
  for (const cell of bottomCells) {
    const label = header(
      groupStartDate(cell.startDate, labelUnit, localeOptions?.firstDayOfWeek)
    );
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.widthPx += cell.widthPx;
    } else {
      groups.push({ label, widthPx: cell.widthPx });
    }
  }

  return groups;
}

export function computeTimelineData(
  rawTasks: Task[],
  selectedScale: GanttScaleKey,
  visibleRange?: GanttVisibleRange,
  hierarchy = false,
  extension: GanttRangeExtension = NO_RANGE_EXTENSION
): TimelineData {
  const fixedStart = visibleRange?.start;
  const fixedEnd = visibleRange?.end;

  if (!rawTasks.length && !(fixedStart && fixedEnd)) {
    return { bottomCells: [], transformedTasks: [] };
  }

  const tree = hierarchy ? buildTaskTree(rawTasks) : undefined;
  const tasks = tree ? rollUpTasks(rawTasks, tree) : rawTasks;

  let rangeStart = fixedStart;
  let rangeEnd = fixedEnd;

  if (!rangeStart || !rangeEnd) {
    const { minDate, maxDate } = findDateRangeFromTasks(tasks);
    const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[selectedScale];
    const buffer = TIMELINE_SHIFT_BUFFER * unitPerTick;
    rangeStart =
      rangeStart ?? minDate.subtract(buffer + extension.before * unitPerTick, tickUnit);
    rangeEnd = rangeEnd ?? maxDate.add(buffer + extension.after * unitPerTick, tickUnit);
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
