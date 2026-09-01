import { GANTT_SCALE_CONFIG, TIMELINE_SHIFT_BUFFER } from "constants/gantt";
import { Dayjs } from "dayjs";
import {
  GanttBottomRowCell,
  GanttDateRange,
  GanttLabelUnit,
  GanttLocaleOptions,
  GanttMarker,
  GanttRangeBand,
  GanttRangeExtension,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs, { startOfQuarter, startOfWeek } from "utils/dayjs";
import { resolveFormatters, resolveLabelUnit } from "utils/i18n";
import { NO_RANGE_EXTENSION } from "utils/viewport";
import { transformTasks } from "./transformData";
import { buildTaskTree, rollUpTasks } from "./tree";

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

/**
 * Date sitting at a px offset along the timeline - the inverse of calculateDateOffsetPx
 * Returns null when the offset falls outside the rendered range
 *
 * Used to remember what the cursor was pointing at before a zoom, so the same date can be
 * put back under it afterwards.
 */
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

/** First and last moment the rendered ticks cover (null for an empty timeline) */
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

/** A marker placed on the timeline, with the overrun check already resolved */
export interface PositionedMarker {
  marker: GanttMarker;
  leftPx: number;
  /** A task covered by the marker ends past its date */
  overrun: boolean;
}

/**
 * Places markers on the timeline, dropping the ones outside the rendered range
 *
 * `warnOnOverrun` markers report whether a task ends past their date - every task, or
 * only the ones named in `taskIds`.
 */
export function computeMarkerOffsets(
  markers: GanttMarker[],
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey,
  tasks: Pick<Task, "id" | "endDate">[] = []
): PositionedMarker[] {
  const placed: PositionedMarker[] = [];

  for (const marker of markers) {
    const date = dayjs(marker.date);
    if (!date.isValid()) continue;

    const leftPx = calculateDateOffsetPx(date, timelineTicks, scaleKey);
    if (leftPx === null) continue;

    const time = date.valueOf();
    const overrun =
      marker.warnOnOverrun === true &&
      tasks.some(
        (task) =>
          (!marker.taskIds || marker.taskIds.includes(task.id)) &&
          dayjs(task.endDate).valueOf() > time
      );

    placed.push({ marker, leftPx, overrun });
  }

  return placed;
}

/** A range band placed on the timeline */
export interface PositionedBand {
  band: GanttRangeBand;
  leftPx: number;
  widthPx: number;
}

/**
 * Places range bands on the timeline, dropping the ones that miss the rendered range
 * entirely (a band that only overlaps it is clipped to the part that is on screen)
 */
export function computeBandRects(
  bands: GanttRangeBand[],
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): PositionedBand[] {
  const range = timelineRange(timelineTicks, scaleKey);
  if (!range) return [];

  const rangeStart = range.start.valueOf();
  const rangeEnd = range.end.valueOf();
  const placed: PositionedBand[] = [];

  for (const band of bands) {
    const start = dayjs(band.startDate);
    const end = dayjs(band.endDate);
    if (!start.isValid() || !end.isValid()) continue;

    // Outside the range, or inverted - calculateDateOffsets would draw a 1px sliver at the origin
    if (end.valueOf() <= rangeStart || start.valueOf() >= rangeEnd) continue;
    if (end.valueOf() <= start.valueOf()) continue;

    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      start,
      end,
      timelineTicks,
      scaleKey
    );

    placed.push({ band, leftPx: barMarginLeftAmount, widthPx: barWidthSize });
  }

  return placed;
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
 * First moment of the group a cell belongs to
 * 'quarter' and 'week' are not dayjs units of their own - see utils/dayjs
 */
function groupStartDate(
  date: Dayjs,
  labelUnit: GanttLabelUnit,
  firstDayOfWeek?: number
): Dayjs {
  if (labelUnit === "quarter") return startOfQuarter(date);
  if (labelUnit === "week") return startOfWeek(date, firstDayOfWeek);
  return date.startOf(labelUnit);
}

/**
 * Builds the top header groups from the bottom cells
 * Used by the header component
 */
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

/**
 * Computes the timeline data
 * Returns bottomCells and transformedTasks for the given rawTasks and scale
 *
 * With hierarchy on, a parentId tree is built and parents are recomputed as summary rows.
 * (Rolled up before the padding is computed so the dates derived from children also widen
 *  the timeline range)
 *
 * `extension` widens the range beyond the usual buffer - that is how scrolling past an
 * edge grows the timeline instead of hitting a wall.
 */
export function computeTimelineData(
  rawTasks: Task[],
  selectedScale: GanttScaleKey,
  hierarchy = false,
  extension: GanttRangeExtension = NO_RANGE_EXTENSION
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
    selectedScale,
    extension
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
