import { GanttColumn, GanttScaleConfig, GanttScaleKey } from 'types/gantt';
import dayjs, { quarterOfYear } from 'core/dates';

export const NODE_HEIGHT = 38;
/** Full timeline header height (44 top group + 28 bottom cell + 1 border) - the grid header matches it */
export const HEADER_HEIGHT = 73;
/** Default grid column width (px) */
export const DEFAULT_COLUMN_WIDTH = 120;
/** Grid pane width limits (px) */
export const MIN_GRID_WIDTH = 120;
export const MAX_GRID_WIDTH = 800;
/** Indentation per tree level (px) */
export const TREE_INDENT = 16;

/** Date format for the grid's date columns - replaceable through the columns prop */
const GRID_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Default task grid columns
 * Replaceable wholesale through the columns prop, so no header label is baked into the library.
 */
export const DEFAULT_COLUMNS: GanttColumn[] = [
  { key: 'name', header: 'Name', width: 220 },
  {
    key: 'startDate',
    header: 'Start',
    width: 110,
    render: (task) => dayjs(task.startDate).format(GRID_DATE_FORMAT),
  },
  {
    key: 'endDate',
    header: 'End',
    width: 110,
    render: (task) => dayjs(task.endDate).format(GRID_DATE_FORMAT),
  },
];
export const TIMELINE_SHIFT_BUFFER = 5;
/** Bars render at least this wide, however narrow they are (px) - keeps short tasks grabbable */
export const MIN_BAR_WIDTH = 14;
/** Below this width the task name is shown outside the bar (px) */
export const MIN_LABEL_INSIDE_WIDTH = 56;
/** Size of the resize edge hit area (px) */
export const EDGE_THRESHOLD = 8;
/**
 * Size of the resize edge hit area for touch and pen (px)
 *
 * The 44px accessibility guideline, applied to the axis the bar can grow along. A bar
 * is half a row tall, so the target cannot also be 44px high without covering the row
 * next to it - what keeps a mistimed tap harmless instead is the long press: a touch
 * has to rest on the edge before anything is lifted.
 */
export const TOUCH_EDGE_THRESHOLD = 44;
/** Below this bar width there is no edge resizing and the whole bar is the move handle (px) */
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
/** Same rule for touch - below this a bar is move-only, so the edges cannot swallow it (px) */
export const MIN_TOUCH_RESIZABLE_WIDTH = TOUCH_EDGE_THRESHOLD * 3;
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
