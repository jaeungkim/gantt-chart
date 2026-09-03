import { Dayjs } from 'dayjs';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
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

export interface GanttBottomRowCell {
  startDate: Dayjs;
  widthPx: number;
}

export interface GanttTopHeaderGroup {
  startDate: Dayjs;
  widthPx: number;
  label: string;
}

/** How rows are grouped: a string reads that field off the task, a function returns the label itself, and empty values land in "Ungrouped". */
export type GanttGroupBy =
  | string
  | ((task: TaskTransformed) => string | null | undefined);

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

/** Why a tooltip is showing */
export type GanttTooltipReason = 'hover' | 'move' | 'resize' | 'progress';

/** Props handed to a `renderTooltip` override */
export interface GanttTooltipRenderProps {
  task: TaskTransformed;
  reason: GanttTooltipReason;
  /** Start being previewed - the live drag value while a gesture is running */
  startDate: Dayjs;
  /** End being previewed */
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

// Everything a bar needs from the chart's props - one object rather than eight
export interface GanttBarOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onTaskClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  onTaskDoubleClick?: (task: TaskTransformed, event: ReactMouseEvent) => void;
  renderTooltip?: GanttTooltipRenderer;
  // Hover and drag tooltips, on unless explicitly turned off
  showTooltip?: boolean;
}

/** What opens the detail panel - `'none'` leaves it to `detailTaskId` and the imperative handle. */
export type GanttDetailTrigger = 'selection' | 'doubleClick' | 'none';

/** Props handed to a `renderDetail` override */
export interface GanttDetailRenderProps {
  task: TaskTransformed;
  /** Closes the panel - wire it to your own close control */
  close: () => void;
  scale: GanttScaleKey;
}

export type GanttDetailRenderer = (props: GanttDetailRenderProps) => ReactNode;
