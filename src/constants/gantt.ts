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
    formatTickLabel: (d) => d.format('h A'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  week: {
    labelUnit: 'week',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('D hh:mm'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  month: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 64,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  year: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 7,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 14,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
};
