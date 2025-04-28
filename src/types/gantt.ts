import { Dayjs } from 'dayjs';

export type GanttScaleKey = 'day' | 'week' | 'month' | 'year';
export interface GanttScaleConfig {
  labelUnit: 'hour' | 'day' | 'week' | 'month' | 'year';
  tickUnit: 'minute' | 'hour' | 'day';
  unitPerTick: number;

  dragStepUnit: 'minute' | 'hour' | 'day';
  dragStepAmount: number;

  basePxPerDragStep: number; // number of px per drag step (how much user can drag in px)

  formatTickLabel?: (date: Dayjs) => string;
  formatHeaderLabel?: (date: Dayjs) => string;
}

export interface GanttBottomRowCell {
  startDate: Dayjs;
  widthPx: number;
}

export interface GanttTopHeaderGroup {
  startDate: Dayjs;
  widthPx: number;
  label: string;
}

export interface GanttDragOffset {
  offsetX: number;
  offsetWidth: number;
  offsetStartDate: Dayjs;
  offsetEndDate: Dayjs;
}
