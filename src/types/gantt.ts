import { Dayjs } from 'dayjs';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
} from 'react';
import type { Task, TaskTransformed } from './task';

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

/** What a gesture is about to write */
export type GanttChangeType = 'move' | 'resize' | 'progress';

/**
 * The mutation a finished gesture wants to commit
 *
 * Handed to `onBeforeTaskChange` before anything is written, so a host can send it to a
 * server and answer with a veto.
 */
export interface GanttTaskChange {
  type: GanttChangeType;
  /** The bar the user grabbed */
  task: Task;
  /** Only the tasks this gesture rewrites - dragging a summary bar carries its whole subtree */
  changedTasks: Task[];
  /** Those same tasks as they were before the gesture, in the same order */
  previousTasks: Task[];
  /** The full array the chart would hand to `onTasksChange` */
  tasks: Task[];
  /** Which edge moved - `resize` only */
  edge?: 'start' | 'end';
}

/**
 * Runs before a gesture is committed and can cancel it
 *
 * Returning `false`, a promise resolving to `false`, or a rejected promise rolls the bar
 * back to where it started. Anything else commits. While the promise is pending the bar
 * stays where it was dropped, so the UI never blocks on the round trip.
 */
export type GanttBeforeChangeHandler = (
  change: GanttTaskChange
) => boolean | void | Promise<boolean | void>;

/** Props handed to a `renderBar` override */
export interface GanttBarRenderProps {
  task: TaskTransformed;
  /** Left offset from the timeline origin in px, live drag offset included */
  left: number;
  /** Rendered bar width in px, live drag offset included */
  width: number;
  /** Row height available to the bar in px */
  height: number;
  /** Progress 0-100, or null when the task has none */
  progress: number | null;
  scale: GanttScaleKey;
  isMilestone: boolean;
  isSummary: boolean;
  isDragging: boolean;
  isSelected: boolean;
  /**
   * Spread onto the root node of the replacement
   *
   * Carries the positioning style plus the drag, click and double-click handlers, so a
   * custom bar keeps behaving like the default one.
   */
  barProps: {
    style: CSSProperties;
    onPointerDown: PointerEventHandler<HTMLDivElement>;
    onClick: MouseEventHandler<HTMLDivElement>;
    onDoubleClick: MouseEventHandler<HTMLDivElement>;
  };
}

export type GanttBarRenderer = (props: GanttBarRenderProps) => ReactNode;

/** Why a tooltip is showing */
export type GanttTooltipReason = 'hover' | 'move' | 'resize' | 'progress';

/** Props handed to a `renderTooltip` override */
export interface GanttTooltipRenderProps {
  task: TaskTransformed;
  reason: GanttTooltipReason;
  /** Start being previewed - the live drag value while a gesture is running */
  startDate: Dayjs;
  /** End being previewed - equal to `startDate` for a milestone */
  endDate: Dayjs;
  /** End minus start in milliseconds */
  durationMs: number;
  /** Progress 0-100, or null when the task has none */
  progress: number | null;
  scale: GanttScaleKey;
}

export type GanttTooltipRenderer = (
  props: GanttTooltipRenderProps
) => ReactNode;

/** Props handed to a `renderHeaderCell` override */
export interface GanttHeaderCellRenderProps {
  /** `'top'` is a merged group label, `'bottom'` a single time tick */
  row: 'top' | 'bottom';
  date: Dayjs;
  /** The label the default header would print */
  label: string;
  width: number;
  scale: GanttScaleKey;
  /** Spread onto the root node of the replacement to keep the header layout intact */
  cellProps: { className: string; style: CSSProperties };
}

export type GanttHeaderCellRenderer = (
  props: GanttHeaderCellRenderProps
) => ReactNode;

/** Everything a bar needs from the chart's props - passed as one object rather than eight */
export interface GanttBarOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onBeforeTaskChange?: GanttBeforeChangeHandler;
  onTaskClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  onTaskDoubleClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  renderBar?: GanttBarRenderer;
  renderTooltip?: GanttTooltipRenderer;
  /** Hover and drag tooltips, on unless explicitly turned off */
  showTooltip?: boolean;
}
