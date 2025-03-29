import { GanttScaleConfig, GanttScaleKey } from 'types/gantt';

export const NODE_HEIGHT = 2.375 * 16;
export const TIMELINE_SHIFT_BUFFER = 1;

export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  hour: {
    labelUnit: 'hour',
    tickUnit: 'minute',
    unitPerTick: 15,
    dragStepUnit: 'minute',
    dragStepAmount: 15,
    basePxPerDragStep: 32, // 32 px per drag for 15 minutes
    formatTickLabel: (d) => d.format('HH:mm'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  day: {
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'minute',
    dragStepAmount: 15,
    basePxPerDragStep: 32, // 32 px per drag for 15 minutes
    formatTickLabel: (d) => d.format('HH:mm'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  week: {
    labelUnit: 'week',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 64, // 64 px per drag for 1 day
    formatTickLabel: (d) => d.format('HH:mm'),
    formatHeaderLabel: (d) => `Week ${d.isoWeek()}`,
  },
  month: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 64, // 16 px per drag for 1 day
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },

  year: {
    labelUnit: 'year',
    tickUnit: 'day',
    unitPerTick: 7,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 8, // 8 px per drag for 1 day
    formatTickLabel: (d) => d.format('MMM'),
    formatHeaderLabel: (d) => d.format('YYYY'),
  },
};
