import { GanttTaskMoveChange } from "core/reorder";
import { GanttTaskDraft } from "features/bars/types";
import { GanttDependencyChange } from "features/dependencies/types";
import { GanttScrollApi } from "features/timeline/types";
import {
  GanttDateRange,
  GanttDetailRenderer,
  GanttFormatOverrides,
  GanttScaleKey,
  GanttTheme,
  Holiday,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";

/** Props of `ReactGanttChart`, every one optional. See https://gantt.jaeungkim.com/docs/ref/props */
export interface GanttProps {
  /** Task data (default `[]`). Applied only when its contents change, so a new array with equal contents is ignored. */
  tasks?: Task[];
  /** Called with the whole updated array after every committed edit, which the chart has already applied. */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Chart height, a number in px or any CSS length (default 600). A defined `style.height` wins. */
  height?: number | string;
  /** Chart width, a number in px or any CSS length (default `"100%"`). A defined `style.width` wins. */
  width?: number | string;
  /** Row height in px (default 38). Anything but a positive finite number keeps the default. */
  rowHeight?: number;
  /** Bar height in px (default 28, scaled with `rowHeight`), capped at `rowHeight - 4`. */
  barHeight?: number;
  /** `'light'`, `'dark'` or `'system'` (the OS setting); omitted, the host page's `color-scheme` decides. */
  theme?: GanttTheme;
  /** Scale the chart starts at (default `"month"`). Read once on mount; use `setScale` on the ref to change it later. */
  defaultScale?: GanttScaleKey;
  /** Called after every scale change from any source (`setScale`, `zoomToFit()`, Ctrl/Cmd + wheel), but not on mount. */
  onScaleChange?: (scale: GanttScaleKey) => void;
  /** Extra class name on the root element, after `gantt-container`. */
  className?: string;
  /** Inline style for the root element, where `--gantt-*` tokens go as strings. A defined `height` or `width` beats the props. */
  style?: React.CSSProperties & {
    [token: `--${string}`]: string | undefined;
  };
  /** Shades non-working days and shows holiday names (default true). `workingCalendar` snapping does not depend on it. */
  showNonWorkingDays?: boolean;
  /** Worked weekdays as UTC day numbers, 0 = Sunday (default Mon-Fri). Compared by identity, so pass a stable array. */
  workingWeekdays?: number[];
  /** Days off on top of `workingWeekdays`, as `YYYY-MM-DD` strings or `Holiday` objects. Compared by identity, so pass a stable array. */
  holidays?: (string | Holiday)[];
  /** Scrolls once, unanimated, to `"today"` or a date string as soon as the timeline renders; it never scrolls again. */
  initialScrollTo?: "today" | string;
  /** Blocks every edit on every task (default false). Any `allowX` flag or a task's own `readOnly` beats it, and it never blocks reordering. */
  readOnly?: boolean;
  /** Allows dragging bars along the timeline (default `!readOnly`). A task's own `allowMove` or `readOnly` wins. */
  allowMove?: boolean;
  /** Allows resizing bars by an edge and editing dates in the detail panel (default `!readOnly`). Summary bars never resize. */
  allowResize?: boolean;
  /** Makes the detail panel's progress field editable (default `!readOnly`). A summary row's progress never is. */
  allowProgressChange?: boolean;
  /** Earliest date (ISO string) any bar may be dragged or edited to. A task's own `minDate` wins. */
  minDate?: string;
  /** Latest date (ISO string) any bar may be dragged or edited to. A task's own `maxDate` wins. */
  maxDate?: string;
  /** Pins the timeline's start to this ISO date instead of fitting the tasks; `infiniteScroll` then never extends that side. */
  visibleStart?: string;
  /** Pins the timeline's end to this ISO date instead of fitting the tasks; `infiniteScroll` then never extends that side. */
  visibleEnd?: string;
  /** BCP 47 tag for every date label via `Intl.DateTimeFormat`, e.g. `"ko-KR"`. Omitted or unusable, the built-in English labels are used. */
  locale?: string;
  /** Per-scale `tick`, `header` and `tooltip` label overrides. They win over `locale`, and the `Dayjs` they get is in UTC mode. */
  formats?: GanttFormatOverrides;
  /** First day of the week, 0 = Sunday to 6 = Saturday. Set, the week scale's top header groups by week instead of by month. */
  firstDayOfWeek?: number;
  /** Shows the task-list pane on the left (default false). It lists names only; per-task detail belongs in `renderDetail`. */
  showTaskList?: boolean;
  /** Prints each row's `sequence` in a leading column of the task list (default false). */
  showRowNumbers?: boolean;
  /** Builds a tree from `parentId` (default false). Parents become summary rows that roll up dates and progress and drag their subtree. */
  hierarchy?: boolean;
  /** Ids of collapsed parents. Given, the chart shows exactly this list and only reports toggles through `onCollapsedChange`. */
  collapsedIds?: string[];
  /** Initial collapsed ids when `collapsedIds` is not given (default `[]`). Read once on mount. */
  defaultCollapsedIds?: string[];
  /** Called with the new collapsed ids on every change, controlled or not. Dropping a row into a collapsed parent expands it too. */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Allows drawing dependencies from a bar's link handles (default `!readOnly`). The task at each end must allow it. */
  allowLinkCreate?: boolean;
  /** Allows selecting and deleting dependency arrows (default `!readOnly`). The successor task's flags decide per arrow. */
  allowLinkDelete?: boolean;
  /** Allows the "Add task" button, `addTask()` and drawing below the last row (default `!readOnly`). Nothing happens without `onTaskCreate`. */
  allowTaskCreate?: boolean;
  /** Lets task-list rows be dragged to a new position or parent (default false). A move rewrites `sequence`, and `parentId` on a re-parent. */
  allowReorder?: boolean;
  /** Called with a drawn link before it is applied. Return `false` to reject it; self-links, duplicates and cycles never reach it. */
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  /** Called with the arrow being deleted before it is removed. Return `false` to keep it. */
  onDependencyDelete?: (change: GanttDependencyChange) => boolean | void;
  /** Called with a draft range from the "Add task" button, `addTask()` or a drag below the last row. The chart adds no task itself. */
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  /** Called with a row move before it is applied. Return `false` synchronously to reject it; moves the chart refuses never reach it. */
  onTaskMove?: (change: GanttTaskMoveChange) => boolean | void;
  /** Fires on a bar or task-list row click, but not on the click that ends a drag. */
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires on a bar or row double click. The two clicks that make it up still fire `onTaskClick`. */
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires when the selection changes, with `null` on an empty-timeline click. Passing it turns selection on. */
  onTaskSelect?: (task: TaskTransformed | null) => void;
  /** Whether a bar or row click selects its task. Omitted, selection is on when `onTaskSelect` is given or the detail panel is on. */
  selectable?: boolean;

  /** Renders the detail panel's body and turns the panel on (default: the built-in field list). It gets `task`, `close`, `scale` and `update`. */
  renderDetail?: GanttDetailRenderer;
  /** Docks a detail panel that a bar or row click opens (default `renderDetail !== undefined`). It also turns selection on unless `selectable` is set. */
  showDetail?: boolean;
  /** Id of the task whose panel is open, `null` for closed. Given, the panel is controlled and clicks only report through `onDetailChange`. */
  detailTaskId?: string | null;
  /** Called on every open and close, controlled or not. Not called when the open task leaves `tasks`, which closes the panel silently. */
  onDetailChange?: (task: TaskTransformed | null) => void;
  /** Shows a bar's hover card (default true). The dates written in the header during a drag show either way. */
  showTooltip?: boolean;
  /** Lets Ctrl/Cmd + wheel step through the scales (default false), keeping the date under the cursor in place. */
  zoomOnWheel?: boolean;
  /** Grows the rendered range about a viewport at a time as a scroll nears either end (default false). A scale change resets it. */
  infiniteScroll?: boolean;
  /** Called with the rendered date range when the timeline first renders and whenever it changes. The hook for lazy-loading tasks. */
  onRangeChange?: (range: GanttDateRange) => void;
  /** Scrolls the timeline when a bar drag reaches a viewport edge (default true). */
  autoScrollOnDrag?: boolean;
  /** Snaps a bar drag's result forward off non-working days from `workingWeekdays` and `holidays` (default false). Bars still span them. */
  workingCalendar?: boolean;
}

/** Opening and closing the detail panel from outside the chart. */
export interface GanttDetailApi {
  /** Opens the detail panel on a task; unknown ids and a panel-less chart (no `renderDetail`/`showDetail`) are ignored. */
  openDetail: (taskId: string) => void;
  /** Closes the detail panel; a no-op while it is already closed. */
  closeDetail: () => void;
}

/** Proposing a new task from outside the chart. */
export interface GanttTaskCreateApi {
  /** Sends a one-tick draft at today (the first tick while today is off the timeline) to `onTaskCreate`, as the "Add task" button does; no-op without it, on an empty timeline, or while `allowTaskCreate` resolves false. */
  addTask: () => void;
}

/** Imperative API exposed through the ref. See https://gantt.jaeungkim.com/docs/ref/handle */
export interface GanttHandle
  extends GanttScrollApi,
    GanttDetailApi,
    GanttTaskCreateApi {}
