import { GanttScaleConfig, GanttScaleKey } from 'types/gantt';

export const NODE_HEIGHT = 38;
export const TIMELINE_SHIFT_BUFFER = 3;

export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    labelUnit: 'day', // laebel unit for the top header
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 1,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('hh'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  week: {
    labelUnit: 'month', 
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 54,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM'),
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
  year: {
    labelUnit: 'month',
    tickUnit: 'month',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 7,
    basePxPerDragStep: 28,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
};
