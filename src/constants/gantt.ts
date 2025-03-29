import { GanttScaleConfig, GanttScaleKey } from 'types/gantt';

export const NODE_HEIGHT = 38;
export const TIMELINE_SHIFT_BUFFER = 3;

export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'minute',
    dragStepAmount: 15,
    basePxPerDragStep: 16,
    formatTickLabel: (d) => d.format('h A'),  // → 9:12 AM, 12:00 PM, 3:45 PM      // 09:00, 10:00...
    formatHeaderLabel: (d) => d.format('MMM D'),     // Jun 1
  },
  week: {
    labelUnit: 'week',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('D'),           // 1, 2, 3...
    formatHeaderLabel: (d) => d.format('MMM'),       // Jun
  },
  month: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 64,
    formatTickLabel: (d) => d.format('D'),           // 1, 2, 3...
    formatHeaderLabel: (d) => d.format('MMM YYYY'),  // Jun 2024
  },
  year: {
    labelUnit: 'year',
    tickUnit: 'day',
    unitPerTick: 7,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 16,
    formatTickLabel: (d) => d.format('D'),         // Jan, Feb...
    formatHeaderLabel: (d) => d.format('YYYY'),      // 2024
  },
};
