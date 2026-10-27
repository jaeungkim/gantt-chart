import { GanttGeometry, GanttScaleConfig, GanttScaleKey } from 'shared/types';
import { quarterOfYear } from 'core/dates';

const DEFAULT_ROW_HEIGHT = 38;
const DEFAULT_BAR_HEIGHT = 28;
const SUMMARY_BAR_RATIO = 18 / 28;
const BAR_ROW_CLEARANCE = 4;

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
  const bar = Math.max(1, Math.min(positiveOr(barHeight, defaultBar), row - BAR_ROW_CLEARANCE));

  return {
    rowHeight: row,
    barHeight: bar,
    summaryBarHeight: Math.max(1, Math.round(bar * SUMMARY_BAR_RATIO)),
  };
}

export const HEADER_HEIGHT = 44 + 28 + 1;
export const MIN_GRID_WIDTH = 120;
export const MAX_GRID_WIDTH = 800;
export const TREE_INDENT = 16;
export const DEFAULT_GRID_WIDTH = 220;
export const TIMELINE_SHIFT_BUFFER = 5;
export const MIN_LABEL_INSIDE_WIDTH = 56;
export const EDGE_THRESHOLD = 8;
export const TOUCH_EDGE_THRESHOLD = 44;
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
export const MIN_TOUCH_RESIZABLE_WIDTH = TOUCH_EDGE_THRESHOLD * 3;

export const LINK_ANCHOR_ZONE = 24;
export const LINK_DRAG_SLOP = 4;
export const LINK_HANDLE_REACH = 26;

export const HOVER_CARD_DELAY_MS = 450;

export const DATE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'MMM D, YYYY HH:mm [UTC]',
  week: 'MMM D, YYYY',
  month: 'MMM D, YYYY',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

export const RANGE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'HH:mm [UTC]',
  week: 'MMM D',
  month: 'MMM D',
  quarter: 'MMM YYYY',
  year: 'MMM YYYY',
};

export const MIN_HOLIDAY_LABEL_PX = 44;

export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 6,
    tickAlign: 'day',
    dragStepUnit: 'hour',
    dragStepAmount: 1,
    basePxPerDragStep: 12,
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
