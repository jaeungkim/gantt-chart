import { Dayjs } from 'dayjs';

export interface GanttTimelineGrid {
  date: Dayjs;
  gridWidthInRem: number;
}
export interface GanttTickSettings {
  intervalUnit: 'day';
  intervalStep: number;
  widthPerIntervalRem: number;
}

export type GanttResizeDirection =
  | 'none'
  | 'move'
  | 'resize-left'
  | 'resize-right';
export type GanttTimelineScale = '연간' | '월간' | '주간';

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
  연간: {
    timeUnit: 'month',
    gridInterval: 2, // 2 months per column for yearly scale
    maxColumns: 25, // maximum number of columns
    tickSettings: {
      intervalUnit: 'day', // unit for tick intervals
      intervalStep: 1, // 1 day per tick
      widthPerIntervalRem: 0.3, // width of each tick in rem here it'd be 0.3 rem for each day
    },
  },
  월간: {
    timeUnit: 'month',
    gridInterval: 1, // 1 month per column for monthly scale
    maxColumns: 30, // maximum number of columns
    tickSettings: {
      intervalUnit: 'day', // unit for tick intervals
      intervalStep: 1, // 1 day per tick
      widthPerIntervalRem: 0.5, // width of each tick in rem here it'd be 0.5 rem for each day
    },
  },
  주간: {
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

export type NodeDependencyConnection = {
  linkActivityId: string; // The connected activity
  dependencyType: dependencyType; // Type of dependency ('FS', 'FF', 'SF', 'SS')
  startX: number;
  startY: number;
  finishX: number;
  finishY: number;
  dependencyOrder?: number; // Order of the dependency
};

export type dependencyType = 'FS' | 'FF' | 'SF' | 'SS';

export type dependencySetUpType = {
  fromActivityId: string;
  parentOfFromActivityId: string;
  toActivityId: string;
  type: dependencyType;
};
