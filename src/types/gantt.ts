import { Dayjs } from 'dayjs';

export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  parentId: string | null;
  sequence: string;
  dependencies?: string[];
}

export interface TaskTransformed extends Task {
  barLeftMargin: number;
  barWidth: number;
  depth: number;
  order: number;
  originalOrder: number;
}

export interface GanttTimelineGrid {
  date: Dayjs;
  gridWidthInRem: number;
}
export interface GanttTickSettings {
  intervalUnit: 'day';
  intervalStep: number;
  widthPerIntervalRem: number;
}
export type GanttTimelineScale = 'yearly' | 'monthly' | 'weekly';
export interface GanttScaleSettings {
  timeUnit: 'month' | 'day'; // Base unit of the scale (month/day)
  gridInterval: number; // Number of time units per grid column (e.g., 2 months, 3 days)
  maxColumns: number; // Maximum number of grid columns
  tickSettings: GanttTickSettings;
}

// Configuration map for available timeline scales
export const ganttScaleSettings: Record<
  GanttTimelineScale,
  GanttScaleSettings
> = {
  yearly: {
    timeUnit: 'month',
    gridInterval: 2, // 2 months per column for yearly scale
    maxColumns: 25, // maximum number of columns
    tickSettings: {
      intervalUnit: 'day', // unit for tick intervals
      intervalStep: 1, // 1 day per tick
      widthPerIntervalRem: 0.3, // width of each tick in rem here it'd be 0.3 rem for each day
    },
  },
  monthly: {
    timeUnit: 'month',
    gridInterval: 1, // 1 month per column for monthly scale
    maxColumns: 30, // maximum number of columns
    tickSettings: {
      intervalUnit: 'day', // unit for tick intervals
      intervalStep: 1, // 1 day per tick
      widthPerIntervalRem: 0.5, // width of each tick in rem here it'd be 0.5 rem for each day
    },
  },
  weekly: {
    timeUnit: 'day', // weekly scale
    gridInterval: 3, // 3 days per column for weekly scale
    maxColumns: 40, // maximum number of columns
    tickSettings: {
      intervalUnit: 'day', // unit for tick intervals
      intervalStep: 1, // 1 day per tick
      widthPerIntervalRem: 5, // width of each tick in rem here it'd be 5 rem for each day
    },
  },
};
