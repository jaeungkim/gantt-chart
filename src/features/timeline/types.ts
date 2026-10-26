import { Dayjs } from "dayjs";
import { GanttScaleKey } from "shared/types";
import type { VirtualItem } from "shared/virtual/window";

/** Options for `scrollToDate`, `scrollToToday` and `scrollToTask`. See https://gantt.jaeungkim.com/docs/ref/handle */
export interface GanttScrollOptions {
  /** Animates the scroll (default `true`); `false`, or a user preference for reduced motion, makes it instant. */
  smooth?: boolean;
  /** Where the target lands horizontally: the left edge of the timeline area, or its centre (default `"center"`). */
  align?: "start" | "center";
}

/** A date pinned at a fixed distance from the timeline's visible left edge */
export interface GanttZoomAnchor {
  date: Dayjs;
  /** px from the left edge of the timeline area (the task list pane excluded) */
  viewportX: number;
}

/** The scroll and zoom methods of `GanttHandle`, the object a chart `ref` receives. See https://gantt.jaeungkim.com/docs/ref/handle */
export interface GanttScrollApi {
  /** Scrolls horizontally to a date; a date outside the rendered timeline is ignored. */
  scrollToDate: (date: string | Date | Dayjs, options?: GanttScrollOptions) => void;
  /** Scrolls horizontally to the current time; ignored while today is outside the rendered timeline. */
  scrollToToday: (options?: GanttScrollOptions) => void;
  /** Scrolls to a task's bar, and vertically only when its row is off screen; a task no row shows, such as one under a collapsed parent, is ignored. */
  scrollToTask: (taskId: string, options?: GanttScrollOptions) => void;
  /** Switches the scale, keeping the centre date centred; an unknown key is ignored. */
  setScale: (scale: GanttScaleKey) => void;
  /** Switches to the finest scale the rendered tasks fit at and pins the earliest start to the left edge; no-op with no tasks. */
  zoomToFit: () => void;
  /** Returns the chart's scroll container element, or `null` while the chart is not mounted. */
  getScrollElement: () => HTMLDivElement | null;
}

export interface GanttVirtualization {
  /** Rows to render, already positioned */
  virtualRows: VirtualItem[];
  /** Height of all rows, culled ones included */
  totalHeight: number;
  /** Time cells to render, already positioned */
  virtualCells: VirtualItem[];
  /** Width of all cells, culled ones included */
  totalWidth: number;
  /** Width of the cells skipped before the first rendered one (px) */
  leadingCellPx: number;
  /** Vertical bounds of the row window (px) - what the arrows cull against */
  rowStartPx: number;
  rowEndPx: number;
  /** Horizontal culling, shared by the bars and the arrows */
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
  syncWindow: () => void;
}
