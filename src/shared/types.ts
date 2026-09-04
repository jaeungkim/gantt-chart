import { Dayjs } from 'dayjs';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { Task, TaskTransformed } from './task';

/** Chart theme - 'system' follows the OS setting; omit the prop to follow the host page's `color-scheme`. */
export type GanttTheme = 'light' | 'dark' | 'system';

export type GanttScaleKey = 'day' | 'week' | 'month' | 'quarter' | 'year';

// Unit the top header row groups by - 'quarter' has no dayjs equivalent, see core/dates
export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

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

  formatTickLabel?: (date: Dayjs) => string;
  formatHeaderLabel?: (date: Dayjs) => string;
}

/** Replaces the generated labels of one scale - whatever is left out keeps the built-in (or locale) label. */
export interface GanttScaleFormat {
  /** Bottom header row - one label per tick */
  tick?: (date: Dayjs) => string;
  /** Top header row - one label per group */
  header?: (date: Dayjs) => string;
  /**
   * Every date the chart writes as a single date: the bar's hover tooltip, its live drag readout
   * and aria-label, the header's drag guide labels (through `edge` and `range`, which follow this
   * slot), and the detail panel's Start and End where they are not editable - an editable date is
   * a native `<input type="date">` and never reaches a formatter.
   */
  tooltip?: (date: Dayjs) => string;
}

/** Per-scale label overrides, e.g. `{ quarter: { header: (d) => ... } }` */
export type GanttFormatOverrides = Partial<
  Record<GanttScaleKey, GanttScaleFormat>
>;

/** Everything that decides how a date turns into a label */
export interface GanttLocaleOptions {
  /** BCP 47 tag handed to `Intl.DateTimeFormat`, e.g. `'ko-KR'` (default: the built-in English labels) */
  locale?: string;
  /** Per-scale label overrides - win over both the locale and the built-in labels */
  formats?: GanttFormatOverrides;
  /** First day of the week, 0 = Sunday .. 6 = Saturday (only affects week grouping) */
  firstDayOfWeek?: number;
}

// The label formatters resolved for one scale. `range` is not a slot of its own: it is
// derived from the same layer that filled `tooltip`, because the header drag readout shows
// one span rather than two dates.
export interface GanttFormatters {
  tick: (date: Dayjs) => string;
  header: (date: Dayjs) => string;
  tooltip: (date: Dayjs) => string;
  range: (start: Dayjs, end: Dayjs) => string;
  /** One end of a dragged range, at the readout's precision - `range` merged both ends */
  edge: (date: Dayjs) => string;
}

/** A day off beyond the weekend. A bare `YYYY-MM-DD` string is the same thing with no label. */
export interface Holiday {
  /** UTC `YYYY-MM-DD` */
  date: string;
  /** Inclusive last day - omit for a single day */
  endDate?: string;
  /** Written in the tick row over the holiday's band, when the band is wide enough to hold it */
  label?: string;
  /** Any CSS colour. Tinted onto the grid at the weekend shade's weight, never painted over it. */
  color?: string;
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

/** The rendered timeline range, as reported by `onRangeChange` */
export interface GanttDateRange {
  start: Dayjs;
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
  offsetStartDate: Dayjs;
  offsetEndDate: Dayjs;
}

// Everything a bar needs from the chart's props - one object rather than eight
export interface GanttBarOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onTaskClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  onTaskDoubleClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  // Hover and drag tooltips, on unless explicitly turned off
  showTooltip?: boolean;
}

/** Props handed to a `renderDetail` override */
export interface GanttDetailRenderProps {
  task: TaskTransformed;
  /** Closes the panel - wire it to your own close control */
  close: () => void;
  scale: GanttScaleKey;
  /**
   * Patches the open task through the chart's normal commit path (the store, then
   * `onTasksChange`), so a custom body can commit edits in uncontrolled mode. Applies NO
   * permission checks - a custom body enforces its own rules.
   */
  update: (patch: Partial<Omit<Task, 'id'>>) => void;
}

export type GanttDetailRenderer = (props: GanttDetailRenderProps) => ReactNode;
