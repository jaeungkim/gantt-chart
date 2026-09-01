import { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import type { TaskTransformed } from './task';

/** Theme type - 'light', 'dark', or 'system' (follows the OS setting) */
export type GanttTheme = 'light' | 'dark' | 'system';

export type GanttScaleKey =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

/** Unit the top header row groups by ('quarter' has no dayjs equivalent - see utils/dayjs) */
export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

export interface GanttScaleConfig {
  labelUnit: GanttLabelUnit;
  tickUnit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  unitPerTick: number;

  dragStepUnit: 'minute' | 'hour' | 'day' | 'week';
  dragStepAmount: number;

  basePxPerDragStep: number;

  formatTickLabel?: (date: Dayjs) => string;
  formatHeaderLabel?: (date: Dayjs) => string;
}

/**
 * Replaces the generated labels of one scale
 * Every entry is optional - whatever is left out keeps the built-in (or locale) label
 */
export interface GanttScaleFormat {
  /** Bottom header row - one label per tick */
  tick?: (date: Dayjs) => string;
  /** Top header row - one label per group */
  header?: (date: Dayjs) => string;
  /** Drag tooltip and drag guide label */
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

/** The three label formatters resolved for one scale */
export interface GanttFormatters {
  tick: (date: Dayjs) => string;
  header: (date: Dayjs) => string;
  tooltip: (date: Dayjs) => string;
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

/**
 * A column of the task grid on the left
 *
 * Every header label and cell body comes from here - the library hardcodes no strings.
 * The first column is the tree column, so indentation and the expander attach to it.
 */
export interface GanttColumn {
  /** React key, and the task field read when there is no render */
  key: string;
  /** What to draw in the header (a string or an element) */
  header: ReactNode;
  /** Column width in px (default 120) */
  width?: number;
  /** Cell renderer - without it, task[key] is shown as a string */
  render?: (task: TaskTransformed) => ReactNode;
}

/** Anything the marker/band props accept as a date */
export type GanttDateInput = string | Date | Dayjs;

/** The rendered timeline range, as reported by `onRangeChange` */
export interface GanttDateRange {
  start: Dayjs;
  end: Dayjs;
}

/**
 * How many extra ticks the rendered range carries beyond the tasks' own span
 *
 * Grows as the user scrolls past an edge; measured in ticks of the current scale, so it
 * is reset whenever the scale changes.
 */
export interface GanttRangeExtension {
  before: number;
  after: number;
}

/** A labelled vertical line at one date - deadlines, releases, and the built-in today line */
export interface GanttMarker {
  /** React key (default: the date) */
  id?: string;
  date: GanttDateInput;
  /** Text shown at the top of the line - omitted, the line is drawn bare */
  label?: string;
  /** Extra class on the marker element */
  className?: string;
  /** Line color - any CSS color, overrides the class and the theme default */
  color?: string;
  /**
   * Turn the marker into a warning (`data-warning="true"`) once a task ends past its date
   *
   * Checks every task, or only `taskIds` when that is given.
   */
  warnOnOverrun?: boolean;
  /** Limits `warnOnOverrun` to these tasks */
  taskIds?: string[];
}

/** A shaded band covering a date range - sprints, phases, freezes */
export interface GanttRangeBand {
  /** React key (default: the start date) */
  id?: string;
  startDate: GanttDateInput;
  endDate: GanttDateInput;
  /** Text shown at the top of the band */
  label?: string;
  /** Extra class on the band element */
  className?: string;
  /** Fill color - any CSS color, overrides the class and the theme default */
  color?: string;
}

export interface GanttDragOffset {
  offsetX: number;
  offsetWidth: number;
  offsetStartDate: Dayjs;
  offsetEndDate: Dayjs;
}
