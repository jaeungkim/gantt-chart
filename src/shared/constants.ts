import { GanttGeometry, GanttScaleConfig, GanttScaleKey } from 'shared/types';
import { quarterOfYear } from 'core/dates';

const DEFAULT_ROW_HEIGHT = 38;
const DEFAULT_BAR_HEIGHT = 28;
// A summary row's bar is thinner than a task's - the shape is what says "roll-up", so the
// cue survives a per-task `color` that repaints the fill
const SUMMARY_BAR_RATIO = 18 / 28;

// The props are a trust boundary: anything but a positive finite number keeps the default
const positiveOr = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;

export function resolveGeometry(
  rowHeight?: number,
  barHeight?: number,
): GanttGeometry {
  const row = positiveOr(rowHeight, DEFAULT_ROW_HEIGHT);
  const defaultBar = Math.round((row * DEFAULT_BAR_HEIGHT) / DEFAULT_ROW_HEIGHT);
  // Leaves a gap above and below every bar for the row rule and the arrows' back-route lanes
  const bar = Math.max(1, Math.min(positiveOr(barHeight, defaultBar), row - 4));

  return {
    rowHeight: row,
    barHeight: bar,
    summaryBarHeight: Math.max(1, Math.round(bar * SUMMARY_BAR_RATIO)),
  };
}

// 44 top group + 28 bottom cell + 1 border (px) - the grid header matches it
export const HEADER_HEIGHT = 73;
// Grid pane width limits (px)
export const MIN_GRID_WIDTH = 120;
export const MAX_GRID_WIDTH = 800;
// Indentation per tree level (px)
export const TREE_INDENT = 16;
// Starting width of the task list pane (px) - the splitter sizes it from here
export const DEFAULT_GRID_WIDTH = 220;
export const TIMELINE_SHIFT_BUFFER = 5;
// Below this width the task name is shown outside the bar (px)
export const MIN_LABEL_INSIDE_WIDTH = 56;
// Size of the resize edge hit area (px)
export const EDGE_THRESHOLD = 8;
// Resize edge hit area for touch and pen (px) - the 44px guideline on the one axis a bar can grow along
export const TOUCH_EDGE_THRESHOLD = 44;
// Below this bar width there is no edge resizing and the whole bar is the move handle (px)
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
// Same rule for touch - below this a bar is move-only, so the edges cannot swallow it (px)
export const MIN_TOUCH_RESIZABLE_WIDTH = TOUCH_EDGE_THRESHOLD * 3;

// How far from a bar's finish a dependency drop still means "finish" (px) - capped at a third of the bar
export const LINK_ANCHOR_ZONE = 24;
// Pointer travel before a press on a connector dot becomes a link drag (px)
export const LINK_DRAG_SLOP = 4;
// How far a link handle's hit pad reaches past the bar's end in styles.css
export const LINK_HANDLE_REACH = 26;

// Dwell before the hover card opens (ms) - the card covers the arrow layer, so transit must not open it
export const HOVER_CARD_DELAY_MS = 450;

// Date format per scale (tooltip) - the chart is UTC, spelled out only where time shows
export const DATE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'MMM D, YYYY HH:mm [UTC]',
  week: 'MMM D, YYYY',
  month: 'MMM D, YYYY',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

// The readout prints one end of the dragged span in the tick cell it lands in. Day, week and
// month drop the year - the top header row above it already spells it out. Quarter and year keep
// it: those spans cross a year. Day drops the date too: its header row is the date and its ticks
// are hours, so the readout is the clock.
export const RANGE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'HH:mm [UTC]',
  week: 'MMM D',
  month: 'MMM D',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

// A holiday band narrower than this writes its name only on hover and leaves the tint to mark
// the day. One day is 72px at the week scale and 18px at the month scale, so this is also what
// decides that names stay up on one and not the other.
export const MIN_HOLIDAY_LABEL_PX = 44;

// The zoom ladder, finest first - declaration order is the ladder, each step out ~4x the last
// in px per calendar day (288-72-18-4-1). Zooming out coarsens the tick so a header cell
// stays ~60-130px rather than shrinking.
// `dragStepUnit` must divide a tick evenly, or createBottomRowCells truncates the cell width.
export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    // Quarter-day cells
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 6,
    tickAlign: 'day',
    dragStepUnit: 'hour',
    dragStepAmount: 1,
    basePxPerDragStep: 12,
    // 24-hour: there is no AM/PM marker here, so a 12-hour label would appear twice a day
    formatTickLabel: (d) => d.format('HH'),
    formatHeaderLabel: (d) => d.format('MMM D, YYYY'),
  },
  week: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 18,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  month: {
    // Week cells - a day cell would be 18px here, too narrow for a date
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 7,
    tickAlign: 'week',
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 18,
    formatTickLabel: (d) => d.format('MMM D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  quarter: {
    labelUnit: 'quarter',
    tickUnit: 'month',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 7,
    basePxPerDragStep: 28,
    formatTickLabel: (d) => d.format('MMM'),
    formatHeaderLabel: (d) => `Q${quarterOfYear(d)} ${d.format('YYYY')}`,
  },
  year: {
    // Quarter cells under a year header - the coarsest zoom; 4-week drag steps keep the weekday
    labelUnit: 'year',
    tickUnit: 'month',
    unitPerTick: 3,
    tickAlign: 'quarter',
    dragStepUnit: 'day',
    dragStepAmount: 28,
    basePxPerDragStep: 28,
    formatTickLabel: (d) => d.format('MMM'),
    formatHeaderLabel: (d) => d.format('YYYY'),
  },
};
