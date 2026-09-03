import { Dayjs } from "dayjs";
import { GanttTaskMoveChange } from "core/reorder";
import { GanttTaskDraft } from "bars/hooks/useGanttDrawCreate";
import { GanttDependencyChange } from "dependencies/hooks/useGanttLinkDrag";
import {
  GanttDateRange,
  GanttDetailRenderer,
  GanttDetailTrigger,
  GanttFormatOverrides,
  GanttGroupBy,
  GanttHeaderCellRenderer,
  GanttScaleKey,
  GanttTheme,
  GanttTooltipRenderer,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";

export interface GanttProps {
  /** Task data array - applied only when the contents change (a new array with equal contents is ignored); `[]` clears the chart. */
  tasks?: Task[];
  /** Callback invoked when tasks change */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Chart height (px or a CSS value) */
  height?: number | string;
  /** Chart width (px or a CSS value) */
  width?: number | string;
  /** Theme setting - 'light', 'dark', or 'system' */
  theme?: GanttTheme;
  /** Scale the chart starts at (default `"month"`) - a mount-time seed; use `setScale` on the ref to change it later. */
  defaultScale?: GanttScaleKey;
  /** Called whenever the scale changes, from any source (ref, Ctrl/Cmd + wheel, `zoomToFit()`, keyboard) - not on mount. */
  onScaleChange?: (scale: GanttScaleKey) => void;
  /** Additional CSS class name */
  className?: string;
  /** Whether to shade weekends/holidays (default true) */
  showNonWorkingDays?: boolean;
  /** Holiday list (ISO date strings, e.g. '2026-01-01') */
  holidays?: string[];
  /** Custom non-working-day predicate - replaces the default weekend/holiday check when given */
  isNonWorkingDay?: (date: Dayjs) => boolean;
  /** Scroll here once after the first render - `"today"` or a date string; later data updates leave the scroll alone. */
  initialScrollTo?: "today" | string;
  /** Blocks moving, resizing and progress dragging on every task */
  readOnly?: boolean;
  /** Allows/blocks moving bars (default true) - beats `readOnly` */
  allowMove?: boolean;
  /** Allows/blocks resizing bars (default true) - beats `readOnly` */
  allowResize?: boolean;
  /** Allows/blocks dragging the progress handle (default true) - beats `readOnly` */
  allowProgressChange?: boolean;
  /** Earliest date any bar may be dragged to (ISO string) - a task's own `minDate` wins */
  minDate?: string;
  /** Latest date any bar may be dragged to (ISO string) - a task's own `maxDate` wins */
  maxDate?: string;
  /** Pins the timeline to start here (ISO string) instead of fitting to the tasks */
  visibleStart?: string;
  /** Pins the timeline to end here (ISO string) instead of fitting to the tasks */
  visibleEnd?: string;
  /** BCP 47 locale tag for every date label, e.g. `"ko-KR"`, via `Intl.DateTimeFormat` - omitted or unusable falls back to the built-in English labels. */
  locale?: string;
  /** Per-scale label overrides (`tick`, `header`, `tooltip`) - they win over `locale`, and the `Dayjs` handed in is in UTC mode. */
  formats?: GanttFormatOverrides;
  /** First day of the week, 0 = Sunday .. 6 = Saturday - set it to group the week scale's top header by week instead of by month (off when omitted). */
  firstDayOfWeek?: number;
  /** Whether to show the task list pane on the left (default false) - names only, per-task detail belongs in `renderDetail`. */
  showTaskList?: boolean;
  /** Whether to use the parentId hierarchy (default false) - parents become summary rows (dates and progress rolled up, dragging moves the subtree); row order still comes from `sequence`. */
  hierarchy?: boolean;
  /** Ids of collapsed parents (controlled - given, this value is what the chart shows) */
  collapsedIds?: string[];
  /** Initial collapsed list (uncontrolled seed; later changes are ignored) */
  defaultCollapsedIds?: string[];
  /** Called whenever the collapsed state changes - in controlled and uncontrolled mode alike */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Groups rows into swimlanes by task field name or accessor - a task's group is read off its root ancestor, and headers collapse under the id `group:<value>`. */
  groupBy?: GanttGroupBy;
  /** Header label for tasks whose group value is missing (default `"Ungrouped"`) */
  ungroupedLabel?: string;
  /** Allows/blocks drawing dependencies between bars (default true) - beats `readOnly` */
  allowLinkCreate?: boolean;
  /** Allows/blocks selecting and deleting dependency arrows (default true) - beats `readOnly` */
  allowLinkDelete?: boolean;
  /** Allows/blocks drawing a new task below the last row (default true) - beats `readOnly` */
  allowTaskCreate?: boolean;
  /**
   * Whether task-list rows can be dragged to a new position or a new parent (default false) - a
   * task's own `allowReorder` wins, and a move rewrites `sequence` (re-parenting also `parentId`).
   */
  allowReorder?: boolean;
  /** Called with the link the user drew, before it is applied - return false to reject it; self-links, duplicates and cycles never reach it. */
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the arrow the user asked to remove, before it is applied - return false to keep it */
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the range drawn below the last row, snapped to the current scale - the chart adds nothing itself, the host passes a new `tasks` array back. */
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  /**
   * Called with the move the user made, before it is applied - return false to reject it (sync only,
   * revert by passing the previous `tasks` back). Carries `toParentId`/`toIndex` and `afterId`/`beforeId`;
   * moves the chart already refuses never reach it.
   */
  onTaskMove?: (change: GanttTaskMoveChange) => boolean | void;
  /** Fires when a bar or a task-list row is clicked (not after a drag) */
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires on a double click. The two clicks that make it up still fire `onTaskClick` */
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires when the selection changes, null when the empty timeline is clicked - passing it turns selection on. */
  onTaskSelect?: (task: TaskTransformed | null) => void;
  /** Whether clicking selects a row - omitted, selection is on exactly when `onTaskSelect` is given. */
  selectable?: boolean;

  /** Panel body shown beside the chart for one task - passing it turns the panel on, and the timeline narrows rather than being covered. */
  renderDetail?: GanttDetailRenderer;
  /**
   * Whether the detail panel is available (omitted, it exists exactly when `renderDetail` is given;
   * `true` alone shows a built-in name-and-dates body). Turning it on also turns row selection on
   * unless `selectable` says otherwise.
   */
  showDetail?: boolean;
  /** What opens the detail panel (default `"selection"`) - `"doubleClick"` waits for a double click, `"none"` leaves it to `detailTaskId` and `openDetail` on the ref. */
  detailTrigger?: GanttDetailTrigger;
  /** Id of the task whose detail is open, `null` for closed (controlled - given, this value is what the chart shows) */
  detailTaskId?: string | null;
  /** Called on every open and close - in controlled and uncontrolled mode alike */
  onDetailChange?: (task: TaskTransformed | null) => void;
  /** Replaces the default tooltip node entirely - used for hover and for drag alike */
  renderTooltip?: GanttTooltipRenderer;
  /** Replaces a timeline header cell entirely - both header rows go through it */
  renderHeaderCell?: GanttHeaderCellRenderer;
  /** Hover and drag tooltips (default true) - `false` suppresses both */
  showTooltip?: boolean;
  /** Whether Ctrl/Cmd + wheel steps through the scale ladder (default false) - the date under the cursor stays put. */
  zoomOnWheel?: boolean;
  /** Whether scrolling or dragging past an end grows the rendered range (default false) - it extends by about a viewport at a time. */
  infiniteScroll?: boolean;
  /** Called whenever the rendered timeline range changes - the hook for lazy-loading tasks */
  onRangeChange?: (range: GanttDateRange) => void;
  /** Whether a bar drag reaching a viewport edge scrolls the timeline (default true) */
  autoScrollOnDrag?: boolean;
  /** Snap a drag result forward off non-working days (default false) - uses the same `holidays` / `isNonWorkingDay` config that shades the timeline; bars still span them visually. */
  workingCalendar?: boolean;
}
