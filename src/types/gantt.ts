import { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import type { SchedulingPolicy, WorkingCalendar } from 'core';
import type { Task, TaskTransformed } from './task';

/**
 * What the drag handlers need to reschedule successors.
 * Assembled once in Gantt and handed down, so the engine's configuration reaches the
 * drag hook without every component in between knowing about it.
 */
export interface GanttScheduling {
  policy: SchedulingPolicy;
  calendar: WorkingCalendar;
  hierarchy: boolean;
  onCycle?: (taskIds: string[]) => void;
}

/** Theme type - 'light', 'dark', or 'system' (follows the OS setting) */
export type GanttTheme = 'light' | 'dark' | 'system';

export type GanttScaleKey =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

/** Unit the top header row groups by ('quarter' has no dayjs equivalent - see core/dates) */
export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

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

/**
 * What a row drag committed - everything needed to persist the move
 *
 * Returning `false` from the callback cancels the drop: nothing is written to the chart and
 * `onTasksChange` does not fire.
 */
export interface GanttReorderChange {
  /** The moved task, already carrying its new parentId and sequence */
  task: Task;
  /** The new parent (null = root) */
  parentId: string | null;
  /** The parent the task had in the incoming data, untouched by normalization */
  previousParentId: string | null;
  /** Zero-based position among the new parent's children */
  index: number;
  /** The moved task's new dotted sequence */
  sequence: string;
  /** The whole updated array - the same one onTasksChange receives */
  tasks: Task[];
}

export interface GanttDragOffset {
  offsetX: number;
  offsetWidth: number;
  offsetStartDate: Dayjs;
  offsetEndDate: Dayjs;
}
