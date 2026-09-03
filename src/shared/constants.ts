import { GanttScaleConfig, GanttScaleKey } from 'shared/types';
import { quarterOfYear } from 'core/dates';

export const NODE_HEIGHT = 38;
// Bar height (px), centred in the NODE_HEIGHT row - connector dots, progress handle and grips sit inside it
export const BAR_HEIGHT = 28;
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
// Keeps the 10px progress dot clear of the resize grip at 0% and 100% (px)
export const PROGRESS_HANDLE_INSET = EDGE_THRESHOLD + 5;
// Resize edge hit area for touch and pen (px) - the 44px guideline on the one axis a bar can grow along
export const TOUCH_EDGE_THRESHOLD = 44;
// Below this bar width there is no edge resizing and the whole bar is the move handle (px)
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
// Same rule for touch - below this a bar is move-only, so the edges cannot swallow it (px)
export const MIN_TOUCH_RESIZABLE_WIDTH = TOUCH_EDGE_THRESHOLD * 3;
// Floor for a rendered bar (px) - tied to MIN_RESIZABLE_WIDTH so a floored bar is still edge-resizable
export const MIN_BAR_WIDTH = MIN_RESIZABLE_WIDTH;

// How far from a bar's finish a dependency drop still means "finish" (px) - capped at a third of the bar
export const LINK_ANCHOR_ZONE = 24;
// Pointer travel before a press on a connector dot becomes a link drag (px)
export const LINK_DRAG_SLOP = 4;

// Dwell before the hover card opens (ms) - the card covers the arrow layer, so transit must not open it
export const HOVER_CARD_DELAY_MS = 450;

// Date format per scale (tooltip and drag guides) - the chart is UTC, spelled out only where time shows
export const DATE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'MMM D, YYYY HH:mm [UTC]',
  week: 'MMM D, YYYY',
  month: 'MMM D, YYYY',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

// The zoom ladder, finest first - declaration order is the ladder.
// A header cell stays ~60-130px, so zooming out coarsens `unitPerTick` instead of shrinking the cell.
// Each step out is 4x the last, in px per calendar day: 288 - 72 - 18 - 4 - 1.
// `dragStepUnit` must divide a tick evenly, or createBottomRowCells truncates the cell width.
export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    // Quarter-day cells - the only scale that draws a task shorter than a day at its true length
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
    // Week cells - a day cell would be 18px here, too narrow for a date or an edge grab
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
