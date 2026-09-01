import { Dayjs } from 'dayjs';

/** Theme type - 'light', 'dark', or 'system' (follows the OS setting) */
export type GanttTheme = 'light' | 'dark' | 'system';

export type GanttScaleKey = 'day' | 'week' | 'month' | 'year';

/** What a bar drag is doing - moving the whole bar, or resizing one edge */
export type GanttDragMode = 'bar' | 'left' | 'right';

/** Window a bar may be dragged within - either end may be left open */
export interface GanttDragBounds {
  min?: Dayjs;
  max?: Dayjs;
}

/** Fixed timeline window, replacing the auto-fit to the task dates */
export interface GanttVisibleRange {
  start?: Dayjs;
  end?: Dayjs;
}

export interface GanttScaleConfig {
  labelUnit: 'hour' | 'day' | 'week' | 'month' | 'year';
  tickUnit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  unitPerTick: number;

  dragStepUnit: 'minute' | 'hour' | 'day' | 'week';
  dragStepAmount: number;

  basePxPerDragStep: number;

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
