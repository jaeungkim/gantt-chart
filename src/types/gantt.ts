import { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import type { Task, TaskTransformed } from './task';

/** Theme type - 'light', 'dark', or 'system' (follows the OS setting) */
export type GanttTheme = 'light' | 'dark' | 'system';

export type GanttScaleKey = 'day' | 'week' | 'month' | 'year';
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
