import { Dayjs } from "dayjs";
import { ReactNode } from "react";
import { GanttTaskDraft } from "hooks/useGanttDrawCreate";
import { GanttDependencyChange } from "hooks/useGanttLinkDrag";
import {
  GanttBarRenderer,
  GanttBeforeChangeHandler,
  GanttColumn,
  GanttDateRange,
  GanttFormatOverrides,
  GanttGroupBy,
  GanttHeaderCellRenderer,
  GanttMarker,
  GanttRangeBand,
  GanttReorderChange,
  GanttScaleKey,
  GanttTheme,
  GanttTooltipRenderer,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { type SchedulingPolicy } from "../core";

export interface GanttProps {
  /**
   * Task data array
   *
   * Only reflected in the chart when the contents actually change. When the
   * parent passes the same data as a new array (an inline literal, a
   * non-memoized map, and so on) the update is ignored, so an edit you just
   * made by dragging is not reverted. Passing an empty array clears the chart.
   */
  tasks?: Task[];
  /** Callback invoked when tasks change */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Chart height (px or a CSS value) */
  height?: number | string;
  /** Chart width (px or a CSS value) */
  width?: number | string;
  /** Theme setting - 'light', 'dark', or 'system' */
  theme?: GanttTheme;
  /**
   * Initial scale
   *
   * A seed value that only applies when the session has no user selection
   * stored (sessionStorage). Once the user changes the scale, that choice is
   * saved and wins on remount, and prop changes after mount are ignored
   * (the usual `default*` prop convention).
   */
  defaultScale?: GanttScaleKey;
  /** Additional CSS class name */
  className?: string;
  /** Whether to shade weekends/holidays (default true) */
  showNonWorkingDays?: boolean;
  /** Holiday list (ISO date strings, e.g. '2026-01-01') */
  holidays?: string[];
  /** Custom non-working-day predicate - replaces the default weekend/holiday check when given */
  isNonWorkingDay?: (date: Dayjs) => boolean;
  /**
   * sessionStorage key the scale selection is stored under (default `"gantt-scale"`)
   *
   * With more than one chart on a page, give them different keys so each
   * remembers its own scale. Sharing one key means the last change made
   * applies to both.
   */
  storageKey?: string;
  /**
   * Position to scroll to once, after the first render
   *
   * `"today"` moves to today, a date string to that date. Later data updates
   * do not touch the scroll position.
   */
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
  /**
   * BCP 47 locale tag for every date label, e.g. `"ko-KR"`
   *
   * Month and day names, header labels and drag tooltips are rendered with
   * `Intl.DateTimeFormat` (no locale packages to install). Left out, the chart keeps
   * its built-in English labels. An unusable tag falls back to those and warns once.
   */
  locale?: string;
  /**
   * Per-scale label overrides - `{ quarter: { header: (d) => ... } }`
   *
   * Each scale takes `tick` (bottom row), `header` (top row) and `tooltip` (drag
   * tooltip and guides); whatever is left out keeps the locale's label. Overrides win
   * over `locale`. The `Dayjs` handed in is in UTC mode.
   */
  formats?: GanttFormatOverrides;
  /**
   * First day of the week, 0 = Sunday .. 6 = Saturday
   *
   * Set it to group the week scale's top header by week starting on that day, instead
   * of by month. Left out, week grouping is off and the header is unchanged.
   */
  firstDayOfWeek?: number;
  /**
   * Whether to show the task list pane on the left
   *
   * Omitted, the pane appears only when `columns` is given - with neither, the chart
   * renders exactly the timeline it does today.
   */
  showTaskList?: boolean;
  /**
   * Column definitions for the task list (default: Name / Start / End)
   *
   * Every header label and cell body comes from here. The first column is the tree
   * column, so indentation and the expander toggle attach to it.
   */
  columns?: GanttColumn[];
  /**
   * Whether to use the parentId hierarchy (default false)
   *
   * With it on, depth comes from the parentId chain rather than from sequence, and a row
   * with children becomes a summary row: its start/end are recomputed from the children
   * (min..max), dragging its bar moves the whole subtree, and a missing progress is rolled
   * up from the children weighted by duration. Row order itself still comes from
   * `sequence`, hierarchy or not.
   */
  hierarchy?: boolean;
  /** Ids of collapsed parents (controlled - given, this value is what the chart shows) */
  collapsedIds?: string[];
  /** Initial collapsed list (uncontrolled seed; later changes are ignored) */
  defaultCollapsedIds?: string[];
  /** Called whenever the collapsed state changes - in controlled and uncontrolled mode alike */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /**
   * Groups the rows into swimlanes - a task field name, or an accessor returning
   * the group value
   *
   * Each group gets a header row and its tasks are indented one level below it.
   * With `hierarchy` on, grouping decides the top level and the parentId nesting
   * is kept inside each group: a task's group is read off its root ancestor, so a
   * subtree is never split across two groups. Group headers collapse through the
   * same `collapsedIds` list, under the id `group:<value>`.
   */
  groupBy?: GanttGroupBy;
  /** Header label for tasks whose group value is missing (default `"Ungrouped"`) */
  ungroupedLabel?: string;
  /** Allows/blocks drawing dependencies between bars (default true) - beats `readOnly` */
  allowLinkCreate?: boolean;
  /** Allows/blocks selecting and deleting dependency arrows (default true) - beats `readOnly` */
  allowLinkDelete?: boolean;
  /** Allows/blocks drawing a new task on empty row space (default true) - beats `readOnly` */
  allowTaskCreate?: boolean;
  /**
   * Called with the link the user drew, before it is applied
   *
   * Return false to reject it. Self-links, duplicates and cycles are rejected by the
   * chart during the drag and never reach this callback.
   */
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the arrow the user asked to remove, before it is applied - return false to keep it */
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
  /**
   * Called with the range drawn on empty row space, snapped to the current scale
   *
   * The chart adds nothing on its own: the host creates the task (or does not) and passes
   * the new `tasks` array back in.
   */
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  /** Fires when a bar or a task-list row is clicked (not after a drag) */
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires on a double click. The two clicks that make it up still fire `onTaskClick` */
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /**
   * Fires when the selection changes - null when the empty timeline is clicked
   *
   * Passing it turns selection on: the selected bar and its task-list row are highlighted.
   */
  onTaskSelect?: (task: TaskTransformed | null) => void;
  /**
   * Whether clicking selects a row
   *
   * Omitted, selection is on only when `onTaskSelect` is given - pass `true` for the
   * highlight without a callback, `false` to turn it off entirely.
   */
  selectable?: boolean;
  /**
   * Runs before a move, resize or progress change is written, and can cancel it
   *
   * Returning `false`, a promise resolving to `false`, or a rejected promise rolls the bar
   * back to where the gesture started. Anything else commits and `onTasksChange` follows.
   * While the promise is pending the bar stays where it was dropped, so a server round trip
   * never blocks the UI - and if the user starts another gesture on that bar in the
   * meantime, the late answer is dropped rather than fighting the newer one.
   */
  onBeforeTaskChange?: GanttBeforeChangeHandler;
  /** Replaces the default bar node entirely - gets the task, its layout, and the handlers to spread */
  renderBar?: GanttBarRenderer;
  /** Replaces the default tooltip node entirely - used for hover and for drag alike */
  renderTooltip?: GanttTooltipRenderer;
  /** Replaces a timeline header cell entirely - both header rows go through it */
  renderHeaderCell?: GanttHeaderCellRenderer;
  /** Hover and drag tooltips (default true) - `false` suppresses both */
  showTooltip?: boolean;
  /**
   * How many undo steps to keep (default 100)
   *
   * One completed gesture is one step, however many bars it moved. 0 turns undo off.
   */
  historyLimit?: number;
  /**
   * Labelled vertical lines at given dates - deadlines, releases, freezes
   *
   * The built-in today line is one of these, so a marker is styled exactly the way it is:
   * a `color`, a `className`, or the `--gantt-marker` variable.
   */
  markers?: GanttMarker[];
  /** Shaded bands covering a date range - sprints, phases, blackout windows */
  rangeBands?: GanttRangeBand[];
  /**
   * Whether Ctrl/Cmd + wheel steps through the scale ladder (default false)
   *
   * The date under the cursor stays put across the change. Plain wheel keeps scrolling
   * vertically and Shift+wheel horizontally either way.
   */
  zoomOnWheel?: boolean;
  /**
   * Whether scrolling or dragging past an end grows the rendered range (default false)
   *
   * Off, the timeline covers the tasks plus a fixed buffer and stops there. On, it extends
   * by about a viewport at a time as either end is approached, and what is on screen stays
   * where it is.
   */
  infiniteScroll?: boolean;
  /** Called whenever the rendered timeline range changes - the hook for lazy-loading tasks */
  onRangeChange?: (range: GanttDateRange) => void;
  /** Whether a bar drag reaching a viewport edge scrolls the timeline (default true) */
  autoScrollOnDrag?: boolean;
  /**
   * How a move propagates to the dragged task's successors (default `"off"`)
   *
   * - `"off"` - nothing propagates. A chart that passes no policy behaves exactly as before.
   * - `"shift-on-overlap"` - a successor is pushed later only when the link would break,
   *   and is never pulled earlier.
   * - `"maintain-gap"` - a successor sits at its earliest legal date, following the
   *   predecessor in both directions, so the gap stays equal to the link's `lag`.
   *
   * Successors are previewed live during the drag and committed in a single
   * `onTasksChange` call on drop. Tasks marked `manuallyScheduled` are never moved.
   */
  schedulingPolicy?: SchedulingPolicy;
  /**
   * Called with the ids caught in a dependency cycle
   *
   * The engine never follows a cycle - those tasks are left where they are and the rest of
   * the project still schedules. Use `canLink` from the core to keep cycles out of the data
   * in the first place.
   */
  onSchedulingCycle?: (taskIds: string[]) => void;
  /**
   * Route every date calculation through a working-day calendar (default false)
   *
   * On, durations, drag results and dependency lag all skip non-working days; bars still
   * span them visually but the days do not count. The calendar is built from the same
   * `holidays` / `isNonWorkingDay` configuration that shades the timeline, so what is
   * shaded and what is skipped cannot drift apart.
   */
  workingCalendar?: boolean;
  /**
   * Compute the critical path and highlight it (default false)
   *
   * Adds a `critical` class to zero-slack bars and to the links along the chain, and fills
   * in the read-only `totalSlack` / `freeSlack` / early / late fields on every task so a
   * `columns` renderer can show them. Tasks at 100% progress are never critical.
   */
  criticalPath?: boolean;
  /**
   * Replaces the default baseline bar
   *
   * Called only for tasks that carry `baselineStart`. Return whatever you like - the
   * element is positioned by the row, not by the renderer.
   */
  renderBaseline?: (task: TaskTransformed) => ReactNode;
  /**
   * Whether a task list row can be dragged to reorder and re-parent (default false)
   *
   * Vertical drag moves the row among its siblings; horizontal offset indents or outdents it
   * the way an outliner does, and dropping onto the middle of a row makes that row the parent.
   * A drop that would put a row inside its own subtree is marked invalid during the drag and
   * does nothing on release.
   *
   * Follows the same guards as a bar move: a row is draggable only where
   * `resolveTaskInteraction` says the task can move, so `readOnly` (or `allowMove: false`, on
   * the chart or on the task) blocks it.
   */
  allowRowReorder?: boolean;
  /**
   * Called when a row drag is released on a legal target, before anything is committed
   *
   * Returning `false` cancels the drop - the chart stays as it was and `onTasksChange` does
   * not fire. Otherwise the chart updates and `onTasksChange` fires once with the same array.
   */
  onReorder?: (change: GanttReorderChange) => void | boolean;
}
