import { Dayjs } from 'dayjs';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { Task, TaskTransformed } from './task';

/** Chart palette: `'system'` follows the OS setting, and leaving `theme` unset follows the host page's `color-scheme`. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttTheme = 'light' | 'dark' | 'system';

/** Timeline zoom level, listed finest first; the chart starts at `'month'` unless `defaultScale` names another. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttScaleKey = 'day' | 'week' | 'month' | 'quarter' | 'year';

// Unit the top header row groups by - 'quarter' has no dayjs equivalent, see core/dates
export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

// Which end of a bar a link attaches to
export type LinkAnchor = 'start' | 'end';

// Why a proposed link cannot be created
export type LinkRejection = 'self' | 'duplicate' | 'cycle';

// What a bar drag is doing - moving the whole bar, or resizing one edge
export type GanttDragMode = 'bar' | 'left' | 'right';

// Window a bar may be dragged within - either end may be left open
export interface GanttDragBounds {
  min?: Dayjs;
  max?: Dayjs;
}

// Fixed timeline window, replacing the auto-fit to the task dates
export interface GanttVisibleRange {
  start?: Dayjs;
  end?: Dayjs;
}

export interface GanttScaleConfig {
  labelUnit: GanttLabelUnit;
  tickUnit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  unitPerTick: number;
  // Boundary the first cell snaps to, so week columns do not open on an arbitrary
  // weekday. Only meaningful for `unitPerTick > 1`.
  tickAlign?: GanttLabelUnit;

  dragStepUnit: 'minute' | 'hour' | 'day' | 'week';
  dragStepAmount: number;

  basePxPerDragStep: number;

  formatTickLabel: (date: Dayjs) => string;
  formatHeaderLabel: (date: Dayjs) => string;
}

/** Replaces one scale's labels; each function gets a UTC-mode `Dayjs`, and a slot left out keeps the locale or built-in label. See https://gantt.jaeungkim.com/docs/ref/scales */
export interface GanttScaleFormat {
  /** Bottom header row, one label per cell. */
  tick?: (date: Dayjs) => string;
  /** Top header row, one label per group; neighbouring groups that get the same label merge into one cell. */
  header?: (date: Dayjs) => string;
  /** Every other date the chart prints: the bar's hover card, the header's drag readout and the detail panel's read-only Start and End. */
  tooltip?: (date: Dayjs) => string;
}

/** The `formats` prop: label overrides per scale, which win over `locale` and the built-in labels. See https://gantt.jaeungkim.com/docs/ref/scales */
export type GanttFormatOverrides = Partial<
  Record<GanttScaleKey, GanttScaleFormat>
>;

/** Everything that decides how a date turns into a label */
export interface GanttLocaleOptions {
  /** BCP 47 tag handed to `Intl.DateTimeFormat`, e.g. `'ko-KR'` (default: the built-in English labels) */
  locale?: string;
  formats?: GanttFormatOverrides;
  /** First day of the week, 0 = Sunday .. 6 = Saturday (only affects week grouping) */
  firstDayOfWeek?: number;
}

// The label formatters resolved for one scale. `range` is not a slot of its own: it is
// derived from the same layer that filled `tooltip`, and writes the header drag readout's two
// ends as one label when they land in one cell.
export interface GanttFormatters {
  tick: (date: Dayjs) => string;
  header: (date: Dayjs) => string;
  tooltip: (date: Dayjs) => string;
  range: (start: Dayjs, end: Dayjs) => string;
  /** One end of a dragged range, at the readout's precision - `range` merged both ends */
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
  /** Start of the first cell, a UTC-mode `Dayjs`. */
  start: Dayjs;
  /** End of the last cell, exclusive: the instant a next cell would start. */
  end: Dayjs;
}

// Extra ticks the rendered range carries beyond the tasks' span, in ticks of the
// current scale - grows on scrolling past an edge, reset when the scale changes
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
  // Hover card, on unless explicitly turned off
  showTooltip?: boolean;
  // Resolved once by the chart - a bar formats its own dates with it
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
