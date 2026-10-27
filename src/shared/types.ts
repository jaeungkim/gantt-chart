import { Dayjs } from 'dayjs';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { Task, TaskTransformed } from './task';

/** Chart palette: `'system'` follows the OS setting, and leaving `theme` unset follows the host page's `color-scheme`. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttTheme = 'light' | 'dark' | 'system';

/** Timeline zoom level, listed finest first; the chart starts at `'month'` unless `defaultScale` names another. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttScaleKey = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export type LinkAnchor = 'start' | 'end';

export type LinkRejection = 'self' | 'duplicate' | 'cycle';

export type GanttDragMode = 'bar' | 'left' | 'right';

export interface GanttDragBounds {
  min?: Dayjs;
  max?: Dayjs;
}

export interface GanttVisibleRange {
  start?: Dayjs;
  end?: Dayjs;
}

export interface GanttScaleConfig {
  labelUnit: GanttLabelUnit;
  tickUnit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  unitPerTick: number;
  tickAlign?: GanttLabelUnit;

  dragStepUnit: 'minute' | 'hour' | 'day' | 'week';
  dragStepAmount: number;

  basePxPerDragStep: number;

  formatTickLabel: (date: Dayjs) => string;
  formatHeaderLabel: (date: Dayjs) => string;
}

/** Replaces one scale's labels; each function gets a `Date` to read in UTC, and a slot left out keeps the locale or built-in label. See https://gantt.jaeungkim.com/docs/ref/scales */
export interface GanttScaleFormat {
  /** Bottom header row, one label per cell. */
  tick?: (date: Date) => string;
  /** Top header row, one label per group; neighbouring groups that get the same label merge into one cell. */
  header?: (date: Date) => string;
  /** Every other date the chart prints: the bar's hover card, the header's drag readout and the detail panel's read-only Start and End. */
  tooltip?: (date: Date) => string;
}

/** The `formats` prop: label overrides per scale, which win over `locale` and the built-in labels. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttFormatOverrides = Partial<
  Record<GanttScaleKey, GanttScaleFormat>
>;

export interface GanttLocaleOptions {
  locale?: string;
  formats?: GanttFormatOverrides;
  firstDayOfWeek?: number;
}

export interface GanttFormatters {
  tick: (date: Dayjs) => string;
  header: (date: Dayjs) => string;
  tooltip: (date: Dayjs) => string;
  range: (start: Dayjs, end: Dayjs) => string;
  edge: (date: Dayjs) => string;
}

/** A day off beyond the weekend, shaded on the day, week and month scales; a bare `YYYY-MM-DD` string is one with no label. See https://gantt.jaeungkim.com/docs/ref/scales */
export interface Holiday {
  /** First day off as UTC `YYYY-MM-DD`; an entry whose date does not parse is dropped. */
  date: string;
  /** Inclusive last day, capped at 366 days in all; one before `date` or unparseable leaves a single day. */
  endDate?: string;
  /** Written in the tick row over the band when the band is 44px or wider, otherwise shown on hover. */
  label?: string;
  /** Any CSS color, tinted at 14% in place of the usual non-working shade. */
  color?: string;
}

export interface GanttBottomRowCell {
  startDate: Dayjs;
  widthPx: number;
}

export interface GanttTopHeaderGroup {
  widthPx: number;
  label: string;
}

/** The span the timeline renders, as `onRangeChange` reports it. See https://gantt.jaeungkim.com/docs/timeline */
export interface GanttDateRange {
  /** Start of the first cell. */
  start: Date;
  /** End of the last cell, exclusive: the instant a next cell would start. */
  end: Date;
}

export interface GanttRangeExtension {
  before: number;
  after: number;
}

export interface GanttDragOffset {
  offsetX: number;
  offsetWidth: number;
  offsetStartDate?: Dayjs;
  offsetEndDate?: Dayjs;
}

export interface GanttGeometry {
  rowHeight: number;
  barHeight: number;
  summaryBarHeight: number;
}

export interface GanttBarOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onTaskActivate?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  onTaskDoubleClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  showTooltip?: boolean;
  tooltip: GanttFormatters['tooltip'];
}

/** What `renderDetail` receives for the open task. See https://gantt.jaeungkim.com/docs/ref/renderers */
export interface GanttDetailRenderProps {
  /** The open task, as the chart laid it out. */
  task: TaskTransformed;
  /** Closes the panel; with `detailTaskId` controlled it only calls `onDetailChange(null)`. */
  close: () => void;
  /** The scale the timeline shows. */
  scale: GanttScaleKey;
  /** Merges a patch into the open task, in the chart and through `onTasksChange`; no permission check or date bound applies. */
  update: (patch: Partial<Omit<Task, 'id'>>) => void;
}

/** Draws the detail panel's body in place of the built-in fields and close button. See https://gantt.jaeungkim.com/docs/ref/renderers */
export type GanttDetailRenderer = (props: GanttDetailRenderProps) => ReactNode;
