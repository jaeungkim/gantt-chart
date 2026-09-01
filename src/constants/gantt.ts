import { GanttScaleConfig, GanttScaleKey } from 'types/gantt';
import { quarterOfYear } from 'utils/dayjs';

export const NODE_HEIGHT = 38;
export const TIMELINE_SHIFT_BUFFER = 5;
/** Bars render at least this wide, however narrow they are (px) - keeps short tasks grabbable */
export const MIN_BAR_WIDTH = 14;
/** Below this width the task name is shown outside the bar (px) */
export const MIN_LABEL_INSIDE_WIDTH = 56;
/** Size of the resize edge hit area (px) */
export const EDGE_THRESHOLD = 8;
/** Below this bar width there is no edge resizing and the whole bar is the move handle (px) */
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
/** Side length of the milestone diamond (px, before the 45-degree rotation) */
export const MILESTONE_SIZE = 16;
/** Horizontal distance from the diamond's center to its vertex (px) */
export const MILESTONE_HALF_DIAGONAL = Math.round((MILESTONE_SIZE * Math.SQRT2) / 2);

/**
 * Date display format per scale (shared by the tooltip and the drag guides) - year included, 24-hour clock
 * The chart is drawn in UTC, so the zone is spelled out only on the day scale, where the time is visible
 */
export const DATE_FORMATS: Record<GanttScaleKey, string> = {
  hour: 'MMM D, YYYY HH:mm [UTC]',
  day: 'MMM D, YYYY HH:mm [UTC]',
  week: 'MMM D, YYYY',
  month: 'MMM D, YYYY',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

/** Declaration order is the order the scale selector lists the scales in - finest first */
export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  hour: {
    // One tick an hour like the day scale, but four times as wide and dragged in
    // quarter-hour steps - the zoom level below 'day'
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'minute',
    dragStepAmount: 15,
    basePxPerDragStep: 30,
    // The date lives in the top row, so the tick only has to say which hour - with 120px
    // to fill, the minutes are spelled out to make the quarter-hour drag steps readable
    formatTickLabel: (d) => d.format('HH:mm'),
    formatHeaderLabel: (d) => d.format('MMM D, YYYY'),
  },
  day: {
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 1,
    basePxPerDragStep: 32,
    // A 12-hour clock has no AM/PM marker here, so the same label would appear twice a day - use 24-hour
    formatTickLabel: (d) => d.format('HH'),
    formatHeaderLabel: (d) => d.format('MMM D, YYYY'),
  },
  week: {
    labelUnit: 'month', 
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 54,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  month: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  quarter: {
    // Same month ticks as the year scale, twice as wide and grouped by quarter on top
    labelUnit: 'quarter',
    tickUnit: 'month',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 3,
    basePxPerDragStep: 24,
    formatTickLabel: (d) => d.format('MMM'),
    formatHeaderLabel: (d) => `Q${quarterOfYear(d)} ${d.format('YYYY')}`,
  },
  year: {
    // Ticks are months, so the top row is the year and the bottom the month - a day (D) on the bottom would always print '1'
    labelUnit: 'year',
    tickUnit: 'month',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 7,
    basePxPerDragStep: 28,
    formatTickLabel: (d) => d.format('MMM'),
    formatHeaderLabel: (d) => d.format('YYYY'),
  },
};
