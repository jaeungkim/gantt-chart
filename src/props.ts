import { GanttTaskMoveChange } from "core/reorder";
import { GanttTaskDraft } from "bars/hooks/useGanttDrawCreate";
import { GanttDependencyChange } from "dependencies/hooks/useGanttLinkDrag";
import {
  GanttDateRange,
  GanttDetailRenderer,
  GanttFormatOverrides,
  GanttScaleKey,
  GanttTheme,
  Holiday,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";

export interface GanttProps {
  /** Task data array. Applied only when the contents change (a new array with equal contents is ignored); `[]` clears the chart. */
  tasks?: Task[];
  /** Callback invoked when tasks change */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Chart height (px or a CSS value, default 600) */
  height?: number | string;
  /** Chart width (px or a CSS value, default `"100%"`) */
  width?: number | string;
  /** Theme setting. One of 'light', 'dark', or 'system'; omitted, the host page's `color-scheme` decides. */
  theme?: GanttTheme;
  /** Scale the chart starts at (default `"month"`). A mount-time seed; use `setScale` on the ref to change it later. */
  defaultScale?: GanttScaleKey;
  /** Called whenever the scale changes, from any source (ref, Ctrl/Cmd + wheel, `zoomToFit()`, keyboard). Not on mount. */
  onScaleChange?: (scale: GanttScaleKey) => void;
  /** Additional CSS class name */
  className?: string;
  /** Whether to shade non-working days and show holiday names (default true). `false` hides both. */
  showNonWorkingDays?: boolean;
  /** Which weekdays are worked, 0 = Sunday (default Mon-Fri). Pass a stable array. */
  workingWeekdays?: number[];
  /** Days off beyond the weekend. A bare `YYYY-MM-DD` string is one with no label. Pass a stable array. */
  holidays?: (string | Holiday)[];
  /** Scroll here once after the first render. Takes `"today"` or a date string; later data updates leave the scroll alone. */
  initialScrollTo?: "today" | string;
  /** Blocks every editing gesture on every task. Any `allowX` flag at either level beats it, and reordering defaults to false whether or not this is set. */
  readOnly?: boolean;
  /** Allows/blocks moving bars, and `Delete` on a focused row (default true). Beats `readOnly`. */
  allowMove?: boolean;
  /** Allows/blocks resizing bars (default true). Beats `readOnly`. */
  allowResize?: boolean;
  /** Allows/blocks dragging the progress handle (default true). Beats `readOnly`. */
  allowProgressChange?: boolean;
  /** Earliest date any bar may be dragged to (ISO string). A task's own `minDate` wins. */
  minDate?: string;
  /** Latest date any bar may be dragged to (ISO string). A task's own `maxDate` wins. */
  maxDate?: string;
  /** Pins the timeline to start here (ISO string) instead of fitting to the tasks */
  visibleStart?: string;
  /** Pins the timeline to end here (ISO string) instead of fitting to the tasks */
  visibleEnd?: string;
  /** BCP 47 locale tag for every date label, e.g. `"ko-KR"`, via `Intl.DateTimeFormat`. Omitted or unusable falls back to the built-in English labels. */
  locale?: string;
  /** Per-scale label overrides (`tick`, `header`, `tooltip`). They win over `locale`, and the `Dayjs` handed in is in UTC mode. */
  formats?: GanttFormatOverrides;
  /** First day of the week, 0 = Sunday .. 6 = Saturday. Set it to group the week scale's top header by week instead of by month (off when omitted). */
  firstDayOfWeek?: number;
  /** Whether to show the task list pane on the left (default false). Names only; per-task detail belongs in `renderDetail`. */
  showTaskList?: boolean;
  /** Whether the task list prints each row's `sequence` as a leading number column (default false). */
  showRowNumbers?: boolean;
  /** Whether to use the parentId hierarchy (default false). Parents become summary rows (dates and progress rolled up, dragging moves the subtree); row order still comes from `sequence`. */
  hierarchy?: boolean;
  /** Ids of collapsed parents. Controlled: given, this value is what the chart shows. */
  collapsedIds?: string[];
  /** Initial collapsed list (uncontrolled seed; later changes are ignored) */
  defaultCollapsedIds?: string[];
  /** Called whenever the collapsed state changes. In controlled and uncontrolled mode alike. */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Allows/blocks drawing dependencies between bars (default true). Beats `readOnly`. */
  allowLinkCreate?: boolean;
  /** Allows/blocks selecting and deleting dependency arrows (default true). Beats `readOnly`. */
  allowLinkDelete?: boolean;
  /** Allows/blocks drawing a new task below the last row (default true). Beats `readOnly`. */
  allowTaskCreate?: boolean;
  /**
   * Whether task-list rows can be dragged to a new position or a new parent (default false). A
   * task's own `allowReorder` wins, and a move rewrites `sequence` (re-parenting also `parentId`).
   */
  allowReorder?: boolean;
  /** Called with the link the user drew, before it is applied. Return false to reject it; self-links, duplicates and cycles never reach it. */
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the arrow the user asked to remove, before it is applied. Return false to keep it. */
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the range drawn below the last row, snapped to the current scale. The chart adds nothing itself; the host passes a new `tasks` array back. */
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  /**
   * Called with the move the user made, before it is applied. Return false to reject it (sync only,
   * revert by passing the previous `tasks` back). Carries `toParentId`/`toIndex` and `afterId`/`beforeId`;
   * moves the chart already refuses never reach it.
   */
  onTaskMove?: (change: GanttTaskMoveChange) => boolean | void;
  /** Fires when a bar or a task-list row is clicked (not after a drag) */
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires on a double click. The two clicks that make it up still fire `onTaskClick` */
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires when the selection changes, null when the empty timeline is clicked. Passing it turns selection on. */
  onTaskSelect?: (task: TaskTransformed | null) => void;
  /** Whether clicking selects a row. Omitted, selection is on when `onTaskSelect` is given or the detail panel is on. */
  selectable?: boolean;

  /** Panel body shown beside the chart for one task. Passing it turns the panel on, and the timeline narrows rather than being covered. The props include `update` for committing edits. */
  renderDetail?: GanttDetailRenderer;
  /**
   * Whether the detail panel is available (omitted, it exists exactly when `renderDetail` is given;
   * `true` alone shows the built-in field list, editable in place where the task's interaction
   * flags allow). A click on a bar or row opens it, `Enter` on a focused row too. Turning it on
   * also turns row selection on unless `selectable` says otherwise.
   */
  showDetail?: boolean;
  /** Id of the task whose detail is open, `null` for closed. Controlled: given, this value is what the chart shows. */
  detailTaskId?: string | null;
  /** Called on every open and close. In controlled and uncontrolled mode alike. */
  onDetailChange?: (task: TaskTransformed | null) => void;
  /** Hover and drag tooltips (default true). `false` suppresses both. */
  showTooltip?: boolean;
  /** Whether Ctrl/Cmd + wheel steps through the scales (default false). The date under the cursor stays put. */
  zoomOnWheel?: boolean;
  /** Whether scrolling or dragging past an end grows the rendered range (default false). It extends by about a viewport at a time. */
  infiniteScroll?: boolean;
  /** Called whenever the rendered timeline range changes. The hook for lazy-loading tasks. */
  onRangeChange?: (range: GanttDateRange) => void;
  /** Whether a bar drag reaching a viewport edge scrolls the timeline (default true) */
  autoScrollOnDrag?: boolean;
  /** Snap a drag result forward off non-working days (default false). Uses the same days that shade the timeline; bars still span them visually. */
  workingCalendar?: boolean;
}
