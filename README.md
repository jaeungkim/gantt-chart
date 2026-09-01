# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

<!-- ![React Gantt Chart](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/readmeImg.png) -->

Lightweight, high-performance Gantt chart component for React applications. Designed for fast rendering with virtualization and clean, minimal aesthetics.

## 🎯 Motivation

I originally wanted to use Microsoft Project's Gantt Chart for personal project management, but it required a subscription 😔. Thus, I decided to build my own Gantt chart, referencing various open-source projects and examples, including MS Project, DHTMLX, Frappe Gantt Chart, and etc.

Since there aren't many open-source Gantt chart solutions available, I hope this project will be useful for others as well. I am very open to feedback, feature requests, and contributions to make this Gantt chart as robust and versatile as possible.

Currently, this project is built specifically for React due to my development background, but in the future, I may explore making it available for other frameworks as well. Since this is my first open-source project, I look forward to learning and improving it with the community!

## ✨ Features

- 📆 Six timeline scales: Hour, Day, Week, Month, Quarter, Year
- 🌏 Any locale through `Intl` (no locale packages), with per-scale label overrides
- 📋 Task list pane with configurable columns, a draggable splitter, and a collapse toggle
- 🌳 Arbitrary-depth tree from `parentId`: expand/collapse, summary bars, subtree drag
- 🔄 Drag-and-drop support:
  - Move entire task bars
  - Resize from left/right edges
  - Snap to configured intervals
  - Reorder and re-parent rows, with indent/outdent on horizontal offset
- ↩️ Undo/redo — one step per gesture, keyboard shortcuts and an imperative API
- 👆 Touch support — long-press to lift a bar, swipe to scroll
- 🧲 Smart dependency arrows (FS, SS, FF, SF) with signed lag/lead, drawn between bars by dragging and removed by selecting
- 🏊 Grouping into swimlanes by any field, and several tasks per row through lanes
- ⌨️ Full keyboard operation - move, resize and delete without a pointer - on an ARIA `treegrid`
- ⚙️ Auto-scheduling: a drag propagates to successors, with cycle detection
- 🗓️ Working-day calendar: durations, lag and snapping skip weekends and holidays
- 🔺 Critical path and slack (CPM forward + backward pass)
- 📊 Baseline bars: planned vs actual, with a milestone diamond
- ✏️ Draw a new task on empty row space, snapped to the current scale
- ◆ Milestones and per-task progress
- 🖱️ Click / double-click / select events with a visible selection highlight
- ↩️ Cancellable before-events: veto a move, resize or progress change and the bar rolls back
- 🎨 Per-task color and class name, plus `renderBar` / `renderTooltip` / `renderHeaderCell` overrides
- 🔒 Read-only mode, per-capability and per-task
- 🚧 Drag bounds and a fixed visible range
- 🗓️ Weekend and holiday shading
- 🔍 Cursor-anchored Ctrl/Cmd + wheel zoom, plus `zoomToFit()`
- ♾️ Range that extends as you scroll or drag past its end, with an `onRangeChange` hook
- ⚡ Virtualized rendering for performance
- 🌙 Light/Dark/System theme support
- 📍 Today marker, custom date markers and shaded range bands
- 💬 Hover and drag tooltips
- 🖼️ Client-side PNG export of the whole chart, no extra dependency
- 📦 Lightweight with minimal dependencies

## 📺 [Demo](https://jaeungkim.com/gantt-chart)

## 🚀 Getting Started

### Installation

```bash
pnpm add @jaeungkim/gantt-chart
# or
npm install @jaeungkim/gantt-chart
```

### Basic Usage

```tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  {
    id: '1',
    name: 'Project Kickoff',
    startDate: '2024-06-01T09:00:00Z',
    endDate: '2024-06-03T17:00:00Z',
    parentId: null,
    sequence: '1',
    dependencies: [],
  },
  {
    id: '2',
    name: 'Requirements Gathering',
    startDate: '2024-06-04T09:00:00Z',
    endDate: '2024-06-10T17:00:00Z',
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: '1', type: 'FS' }],
  },
];

export default function App() {
  return (
    <ReactGanttChart
      tasks={tasks}
      height="100vh"
      width="100%"
      theme="system"
      defaultScale="month"
      onTasksChange={(updated) => console.log('Tasks updated:', updated)}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tasks` | `Task[]` | `[]` | Array of task objects to render |
| `onTasksChange` | `(tasks: Task[]) => void` | - | Callback when tasks are moved or resized |
| `height` | `number \| string` | `600` | Chart height (px or CSS value) |
| `width` | `number \| string` | `"100%"` | Chart width (px or CSS value) |
| `theme` | `"light" \| "dark" \| "system"` | - | Theme mode |
| `defaultScale` | `GanttScaleKey` | `"month"` | Initial timeline scale — `"hour"`, `"day"`, `"week"`, `"month"`, `"quarter"` or `"year"` |
| `className` | `string` | - | Additional CSS class for the container |
| `showNonWorkingDays` | `boolean` | `true` | Shade weekends and holidays at day/week scales |
| `holidays` | `string[]` | - | Extra non-working dates, `YYYY-MM-DD` |
| `isNonWorkingDay` | `(date: Dayjs) => boolean` | - | Replaces the default weekend/holiday check entirely |
| `initialScrollTo` | `"today" \| string` | - | Scroll here once after the first render |
| `storageKey` | `string` | `"gantt-scale"` | sessionStorage key for the scale. Give each chart its own key when rendering more than one on a page. |
| `locale` | `string` | - | BCP 47 tag for every date label, e.g. `"ko-KR"` ([i18n](#i18n-and-date-formats)) |
| `formats` | `GanttFormatOverrides` | - | Per-scale label overrides |
| `firstDayOfWeek` | `number` | - | 0 = Sunday .. 6 = Saturday. Set it to group the week scale's header by week |
| `showTaskList` | `boolean` | - | Show the task list pane. Omitted, the pane appears only when `columns` is given |
| `columns` | `GanttColumn[]` | Name / Start / End | Task list columns. Every header label and cell body comes from here |
| `hierarchy` | `boolean` | `false` | Turn on the `parentId` tree: indentation, expanders, summary bars, subtree drag |
| `collapsedIds` | `string[]` | - | Ids of collapsed parents (controlled) |
| `defaultCollapsedIds` | `string[]` | - | Initial collapsed ids (uncontrolled seed) |
| `onCollapsedChange` | `(ids: string[]) => void` | - | Fires whenever a row is expanded or collapsed |
| `onTaskClick` | `(task, event) => void` | - | A bar or task-list row was clicked. Not fired for the click that ends a drag |
| `onTaskDoubleClick` | `(task, event) => void` | - | A bar or row was double-clicked |
| `onTaskSelect` | `(task \| null) => void` | - | The selection changed; `null` when the empty timeline is clicked. Passing it turns selection on |
| `selectable` | `boolean` | `onTaskSelect !== undefined` | Selection highlight without a callback (`true`), or off entirely (`false`) |
| `onBeforeTaskChange` | `(change) => boolean \| void \| Promise<boolean \| void>` | - | Runs before a move, resize or progress change is written. `false`, a promise resolving to `false`, or a rejection rolls the bar back |
| `renderBar` | `(props) => ReactNode` | - | Replaces the bar node entirely |
| `renderTooltip` | `(props) => ReactNode` | - | Replaces the tooltip node entirely, for hover and drag alike |
| `renderHeaderCell` | `(props) => ReactNode` | - | Replaces a timeline header cell entirely; both header rows go through it |
| `showTooltip` | `boolean` | `true` | `false` suppresses the hover and drag tooltips |
| `readOnly` | `boolean` | `false` | Blocks every editing gesture. A task's own `readOnly` and the `allow*` flags win over it |
| `allowMove` | `boolean` | `true` | Allows/blocks moving bars. Beats `readOnly` |
| `allowResize` | `boolean` | `true` | Allows/blocks resizing bars. Beats `readOnly` |
| `allowProgressChange` | `boolean` | `true` | Allows/blocks dragging the progress handle. Beats `readOnly` |
| `minDate` | `string` | - | Earliest date any bar may be dragged to (UTC ISO string) |
| `maxDate` | `string` | - | Latest date any bar may be dragged to (UTC ISO string) |
| `visibleStart` | `string` | - | Pins the timeline start (UTC ISO string) instead of fitting to the tasks |
| `visibleEnd` | `string` | - | Pins the timeline end (UTC ISO string) instead of fitting to the tasks |
| `historyLimit` | `number` | `100` | How many undo steps to keep. `0` turns undo off ([undo/redo](#undoredo)) |
| `allowRowReorder` | `boolean` | `false` | Let a task list row be dragged to reorder siblings and re-parent. Follows `readOnly` / `allowMove` |
| `onReorder` | `(change: GanttReorderChange) => void \| boolean` | - | Fires on a row drop, before anything is committed. Return `false` to cancel |
| `markers` | `GanttMarker[]` | - | Labelled vertical lines at given dates ([markers](#markers-and-range-bands)) |
| `rangeBands` | `GanttRangeBand[]` | - | Shaded bands covering a date range |
| `zoomOnWheel` | `boolean` | `false` | Ctrl/Cmd + wheel steps through the scale ladder ([zoom](#zooming)) |
| `infiniteScroll` | `boolean` | `false` | Extend the rendered range when scrolling or dragging past an end |
| `onRangeChange` | `(range: GanttDateRange) => void` | - | Fires whenever the rendered timeline range changes |
| `autoScrollOnDrag` | `boolean` | `true` | Scroll the timeline when a bar drag reaches a viewport edge |
| `allowLinkCreate` | `boolean` | `true` | Show the connector dots and accept dependency drags ([editing dependencies](#editing-dependencies)) |
| `allowLinkDelete` | `boolean` | `true` | Let arrows be selected and removed |
| `allowTaskCreate` | `boolean` | `true` | Let a task be drawn on empty row space ([drawing a task](#drawing-a-task)) |
| `onDependencyCreate` | `(change: GanttDependencyChange) => boolean \| void` | - | Fires before a drawn link is applied — return `false` to reject it |
| `onDependencyDelete` | `(change: GanttDependencyChange) => boolean \| void` | - | Fires before an arrow is removed — return `false` to keep it |
| `onTaskCreate` | `(draft: GanttTaskDraft) => void` | - | Fires with the range drawn on empty row space. Required for the gesture to do anything |
| `groupBy` | `string \| (task) => string` | - | Group rows into swimlanes by a task field or an accessor ([grouping](#grouping-and-swimlanes)) |
| `ungroupedLabel` | `string` | `"Ungrouped"` | Header label for tasks whose group value is missing |
| `schedulingPolicy` | `"off" \| "shift-on-overlap" \| "maintain-gap"` | `"off"` | How a drag propagates to the dragged task's successors |
| `onSchedulingCycle` | `(taskIds: string[]) => void` | - | Called with the ids caught in a dependency cycle |
| `workingCalendar` | `boolean` | `false` | Route date arithmetic through a working-day calendar |
| `criticalPath` | `boolean` | `false` | Compute and highlight the critical path, and expose slack |
| `renderBaseline` | `(task: TaskTransformed) => ReactNode` | - | Replaces the default baseline bar |

## Task List and Hierarchy

```tsx
import { ReactGanttChart, type GanttColumn } from '@jaeungkim/gantt-chart';

const columns: GanttColumn[] = [
  { key: 'name', header: 'Task', width: 240 },
  { key: 'sequence', header: 'WBS', width: 70 },
  {
    key: 'progress',
    header: <abbr title="Percent complete">%</abbr>,
    width: 60,
    render: (task) => `${task.progress ?? 0}%`,
  },
];

<ReactGanttChart
  tasks={tasks}
  columns={columns}
  hierarchy
  defaultCollapsedIds={['phase-2']}
  onCollapsedChange={(ids) => localStorage.setItem('collapsed', JSON.stringify(ids))}
/>;
```

```ts
interface GanttColumn {
  key: string;                                 // React key, and the task field read when there is no render
  header: ReactNode;                           // anything - a string, an icon, a whole element
  width?: number;                              // px, default 120
  render?: (task: TaskTransformed) => ReactNode;
}
```

The pane lives inside the timeline's own scroll container as a sticky column, so the two
sides share one row virtualizer and cannot drift apart. Drag the splitter on its right edge
(or focus it and press ←/→) to resize; the toolbar button collapses the pane entirely. Both
are local UI state - nothing is persisted for you.

`columns` replaces the default Name / Start / End set wholesale, so no header label is baked
into the library. The **first column is the tree column**: indentation and the expander
toggle attach to it.

### Tree semantics

With `hierarchy` on, `parentId` becomes the source of truth:

- **Depth** comes from the `parentId` chain rather than from `sequence`. Row *order* still
  comes from `sequence`, so keep child sequences under their parent's (`2`, `2.1`, `2.1.1`).
- **A row with children is a summary row.** Its `startDate`/`endDate` are always recomputed
  from the children — `min(child start)`..`max(child end)`, deepest first, so a grandchild's
  move travels all the way up. Whatever dates the data carries for a parent are ignored.
  A milestone child counts at its `startDate` alone.
- **Summary rows cannot be resized**, and their progress handle is hidden: both ends and the
  rolled-up percentage are derived values that would snap straight back.
- **Dragging a summary bar moves its whole subtree** by the same delta and commits it as a
  single `onTasksChange` call containing every moved task.
- **Progress rolls up** from the children weighted by duration when the parent has no
  explicit `progress`; a child without one counts as 0%, and a parent whose children all
  lack progress gets none. An explicit parent `progress` is left alone.
- **Collapsing hides the whole subtree** from the grid and the timeline at once.
- **Broken links are contained, never fatal:** an orphaned `parentId`, a self-reference, or a
  `parentId` cycle simply becomes a root instead of hanging the render.

Collapse state is controlled with `collapsedIds` and uncontrolled with `defaultCollapsedIds`;
`onCollapsedChange` fires either way, so a host can persist it wherever it likes.

## Grouping and Swimlanes

`groupBy` puts every row into a group and draws a header row in front of each one. It takes
a task field name or an accessor, and the value it returns is the header label.

```tsx
// by a field on the task
<ReactGanttChart tasks={tasks} showTaskList groupBy="assignee" />

// or by anything you can compute
<ReactGanttChart
  tasks={tasks}
  showTaskList
  groupBy={(task) => (task.progress === 100 ? 'Done' : 'In progress')}
/>
```

- Groups appear in **first-appearance order** - the order their first task has in the
  `sequence` sort. There is no separate ordering prop and no group with nothing in it.
- A task whose group value is empty, `null` or `undefined` lands in one **`Ungrouped`**
  bucket; rename it with `ungroupedLabel`.
- **Group headers collapse like any other row**, through the same `collapsedIds` /
  `defaultCollapsedIds` / `onCollapsedChange` triple, under the id `` `group:<value>` ``.

### Several tasks on one row

Give tasks the same `lane` and they share a row:

```tsx
const tasks = [
  { id: '1', name: 'Design',   lane: 'Ana', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-06T00:00:00Z', /* ... */ },
  { id: '2', name: 'Handover', lane: 'Ana', startDate: '2026-03-09T00:00:00Z', endDate: '2026-03-11T00:00:00Z', /* ... */ },
  { id: '3', name: 'Review',   lane: 'Ana', startDate: '2026-03-04T00:00:00Z', endDate: '2026-03-05T00:00:00Z', /* ... */ },
];
```

Tasks 1 and 2 do not overlap, so they are drawn side by side on one row. Task 3 overlaps
task 1, so it **stacks onto a second row** rather than being drawn on top of it - lanes are
packed greedily, in start-date order, into as few rows as the overlaps allow. A task that
starts exactly when the previous one ends still shares the row. Lanes are packed inside
their group, so two tasks with the same lane in different groups never merge.

The task list shows the row's first task with a `+N` badge for the rest.

### How grouping composes with hierarchy

With both `groupBy` and `hierarchy` on, **grouping decides the top level and the `parentId`
nesting is kept inside each group**:

- A task's group is read off its **root ancestor**, never off the task itself, so a subtree
  is never split across two groups even when a child's own field says otherwise.
- Inside a group the tree is unchanged: indentation, summary bars, subtree drag and
  progress roll-up all behave exactly as they do without grouping.
- Levels shift down by one - the group header is `aria-level` 1, a root task is 2, its child
  is 3, and so on.
- Summary roll-up happens **before** grouping, so a summary's dates are its children's dates
  regardless of how the rows are then grouped.

## Keyboard and Screen Readers

The chart is a single ARIA `treegrid`: the task list holds the rows and each row *owns* its
bars in the timeline (`aria-owns`), so the two panes read as one widget rather than two
unrelated lists. **Tab enters and leaves the whole chart once** - inside it, the arrow keys
move a roving tabindex from cell to cell.

Every pointer gesture has a keyboard equivalent, so nothing on the chart depends on being
able to drag (WCAG 2.1 *2.5.7 Dragging Movements*).

| Key | Action |
|-----|--------|
| <kbd>Tab</kbd> | Enter or leave the chart - one stop, wherever the focus was left |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Previous / next row, keeping the column |
| <kbd>←</kbd> / <kbd>→</kbd> | Previous / next cell - across the task list columns and on to the bars |
| <kbd>→</kbd> on the first cell | Expand a collapsed row or group |
| <kbd>←</kbd> on the first cell | Collapse an expanded row or group |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last cell of the row |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Home</kbd> / <kbd>End</kbd> | First / last row of the chart |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Expand or collapse an expandable row, otherwise announce the focused task |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete the focused task and its subtree |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | **Move** the bar one drag step earlier / later |
| <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | **Resize** the end date by one drag step |
| <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | **Resize** the start date by one drag step |
| <kbd>+</kbd> / <kbd>-</kbd> | Progress up / down by 5 points |

One drag step is the scale's own snap unit - a day on the month scale, six hours on the week
scale, fifteen minutes on the hour scale - so a keyboard edit lands on exactly the same date
a drag of the same distance would.

Every edit goes through the same permission check as a drag: **a read-only chart cannot be
edited from the keyboard either**, milestones and summary rows still refuse to resize, drag
bounds still clamp, and a summary still carries its subtree and commits one `onTasksChange`.
A refused key press is announced rather than silently ignored.

### ARIA structure

```
treegrid  "Gantt chart"                aria-rowcount
├─ row                                 the column header row
│  └─ columnheader ...                 one per column, plus a hidden "Timeline"
└─ rowgroup
   └─ row       aria-level             1 for a group header or a root task
                aria-posinset/setsize  position among the rows sharing its parent
                aria-expanded          only on a summary row or a group header
                aria-owns              the row's bars, over in the timeline
      ├─ gridcell  ...                 one per task list column
      └─ gridcell  "Design phase, Mar 3 to Mar 14, 40% complete"
```

Bars carry the dates and the percentage in their label because a screen reader user never
sees the date header above them; milestones read as `"Launch, milestone, Mar 3"` and summary
rows as `"Phase 1, summary, ..."`. Date changes made from the keyboard are announced through
a polite live region, and animations are dropped under `prefers-reduced-motion`.

Without the task list pane the timeline rows become the treegrid's rows, and everything
above holds unchanged.

## Interaction Control

### Read-only and per-task capabilities

Every interaction prop has a matching optional field on `Task`, and the task's own
field wins. Resolution runs most specific first:

`task.allowX` > `task.readOnly` > `allowX` prop > `readOnly` prop > allowed

A blocked gesture renders no affordance at all - no grab or resize cursor, no resize
grips, no progress handle, no connector dots, and arrows that cannot be clicked - rather
than failing on interaction.

`allowLinkCreate` and `allowLinkDelete` resolve the same way and also exist on `Task`;
`allowTaskCreate` is chart-wide only, because that gesture starts on a row rather than on
a task. These decide what the user
can *start*; [`onBeforeTaskChange`](#cancellable-changes-and-optimistic-updates) decides what
survives once a gesture has finished.

Two structural rules are not flags and cannot be turned back on, because the gesture
would have nowhere to write to: milestones are never resizable, and summary rows are
never resizable and have no draggable progress (both are derived from their children).
Summary rows can still be *moved*, carrying their whole subtree.

```tsx
// A fully frozen chart
<ReactGanttChart tasks={tasks} readOnly />

// Frozen except progress, which stays draggable everywhere
<ReactGanttChart tasks={tasks} readOnly allowProgressChange />

// Editable chart with a few exceptions and a drag window
<ReactGanttChart
  tasks={[
    { ...baseline, readOnly: true },                    // this one is frozen
    { ...review, allowResize: false },                  // movable, not resizable
    { ...launch, minDate: '2026-03-01T00:00:00Z' },     // cannot slip earlier than March
  ]}
  minDate="2026-01-01T00:00:00Z"
  maxDate="2026-12-31T00:00:00Z"
/>
```

### Drag bounds

Dragging against a bound snaps to it: the bar stops on the bound and the date passed
to `onTasksChange` is the bound itself. A move keeps its bar length while snapping;
a resize is still never allowed to invert the bar, so the non-inversion guard wins if a
task's window has already been passed.

With `hierarchy` on, a subtree drag has to move as one delta or the group tears apart,
so **the subtree moves by the smallest amount any member's bounds allow** - a bound on a
descendant constrains the whole drag, and no bar can be pushed out of its window by
grabbing its parent. A bar already outside its own window simply refuses to move further
rather than dragging the group backwards.

## Fixed Visible Range

`visibleStart` / `visibleEnd` pin the rendered timeline instead of auto-fitting to the
task dates plus a buffer. Either end can be pinned on its own, and the other keeps
auto-fitting.

```tsx
<ReactGanttChart
  tasks={tasks}
  visibleStart="2026-01-01T00:00:00Z"
  visibleEnd="2026-04-01T00:00:00Z"
/>
```

## Touch

Move, resize and progress all work with a finger, without giving up scrolling:

- **A swipe scrolls, a long press drags.** Touching a bar and moving straight away pans
  the timeline the way touching anywhere else does. Resting on it for ~400ms lifts the
  bar instead, and from then on the gesture is a drag — the bar picks up its usual
  drag styling as the cue. Drifting more than ~10px during that wait hands the gesture
  back to the scroll.
- **Bigger targets.** The resize edges are 44px wide for touch instead of 8px, and the
  progress handle gets a 44px hit area and is visible without hover. A bar too narrow
  to spare two 44px edges is move-only, the same rule the mouse already follows at 8px.
- **Drawing a task follows the same rule.** A swipe across empty row space scrolls;
  resting there for ~400ms starts the draw instead.
- **Connector dots show on selection.** They are revealed by hover, which a finger does
  not have — tapping a bar selects it and reveals them too.
- **A mouse is untouched.** Mouse presses still start a drag immediately with the
  original 8px edges.

## Row Reordering

`allowRowReorder` makes the task list rows draggable:

```tsx
import { ReactGanttChart, type GanttReorderChange } from '@jaeungkim/gantt-chart';

<ReactGanttChart
  tasks={tasks}
  showTaskList
  hierarchy
  allowRowReorder
  onReorder={(change: GanttReorderChange) => {
    // Persist the move; return false here to reject it and leave the chart alone
    void api.moveTask(change.task.id, change.parentId, change.index);
  }}
  onTasksChange={setTasks}
/>;
```

- **Vertical drag reorders**, and an insertion line shows where the row would land.
- **Horizontal offset indents and outdents**, the way an outliner does: one `16px` step to
  the right nests the row under the row above, a step to the left lifts it out. It cannot go
  deeper than one level under the row above, nor shallower than the row below.
- **Dropping on the middle of a row re-parents into it** — that row is highlighted and the
  dragged row is appended to its children, whether it is expanded or collapsed.
- **A row can never become its own descendant.** Such a drop is drawn in the warning colour
  during the drag and does nothing on release; no callback fires.
- **A row follows the same guards a bar move does.** `readOnly`, or `allowMove: false` on
  the chart or on the task, makes that row undraggable ([Interaction Control](#interaction-control)).
- **`onReorder` runs before anything is committed.** Return `false` and the chart stays as it
  was and `onTasksChange` never fires. Otherwise the chart updates and `onTasksChange` fires
  exactly once, with the same array `change.tasks` carries.

```ts
interface GanttReorderChange {
  task: Task;                      // the moved task, with its new parentId and sequence
  parentId: string | null;         // the new parent (null = root)
  previousParentId: string | null; // the parent the incoming data had
  index: number;                   // zero-based position among the new parent's children
  sequence: string;                // the moved task's new dotted sequence
  tasks: Task[];                   // the whole updated array
}
```

### `sequence` after a reorder

Row order comes from `sequence` and nesting from `parentId`, so a move that only rewrote
`parentId` would be undone by the next sort. **A reorder therefore renumbers `sequence` across
the whole array from the resulting tree** — `1`, `1.1`, `1.2`, `2`, … — which makes `sequence`
a derived value (position among siblings, prefixed by the parent's) that cannot disagree with
`parentId` again. Two consequences worth knowing:

- Rows other than the dragged one get new `sequence` values. Persist the array
  `onTasksChange` hands you, not just the moved task.
- If the incoming data already had `sequence` and `parentId` disagreeing, the first reorder
  reconciles them, so unrelated rows may visibly snap into their true tree order.

`parentId` is only ever written on the moved task. A row whose parent link is an orphan or a
cycle keeps that link untouched and is numbered as the root the chart already renders it as.

## Events and Selection

```tsx
<ReactGanttChart
  tasks={tasks}
  onTaskClick={(task, event) => console.log('clicked', task.id, event.shiftKey)}
  onTaskDoubleClick={(task) => openEditor(task.id)}
  onTaskSelect={(task) => setSelectedId(task?.id ?? null)}
/>
```

Both panes fire the same events: a click on a bar and a click on its task-list row are the
same event, and the selected row is highlighted in both places at once.

- Passing `onTaskSelect` turns selection on. Pass `selectable` explicitly for the highlight
  without a callback (`selectable`) or to turn it off (`selectable={false}`).
- `onTaskSelect` fires only when the selection actually changes; clicking the empty timeline
  clears it and reports `null`.
- The click that ends a drag is swallowed, so dragging a bar never registers as a click.
- A double click is still two clicks in the DOM: `onTaskClick` fires twice and
  `onTaskDoubleClick` once. Key off the double click, not off a click count.

## Cancellable Changes and Optimistic Updates

`onBeforeTaskChange` runs after the gesture ends and before anything is written. It is the
persistence hook: `await` your API, and answer.

| The handler returns | What happens |
|---------------------|--------------|
| nothing, or `true` | The change is committed and `onTasksChange` fires |
| `false` | The change is dropped and the bar animates back |
| a promise resolving to anything but `false` | Committed once it settles |
| a promise resolving to `false` | Rolled back once it settles |
| a rejected promise, or a synchronous throw | Rolled back - the failed-server case |

While the promise is pending the bar **stays where the user dropped it** — nothing is
disabled, nothing is frozen, and the user can keep working. If they start another gesture on
that same bar before the answer arrives, the late answer is dropped: the newer gesture owns
the bar and gets its own decision. Moves and resizes share one lane per task; a progress edit
runs in its own, so a pending date change and a progress change never cancel each other.

```tsx
function Schedule() {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <ReactGanttChart
      tasks={tasks}
      // The bar is already where the user dropped it while this runs
      onBeforeTaskChange={async (change) => {
        try {
          const response = await fetch('/api/tasks/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              change.changedTasks.map((task) => ({
                id: task.id,
                startDate: task.startDate,
                endDate: task.endDate,
                progress: task.progress,
              })),
            ),
          });

          // A 409 from the server rolls the bar back to where the drag started
          if (!response.ok) return false;
        } catch (error) {
          // Network failure - same thing, and the bar never lies about what was saved
          toast.error('Could not save the change');
          return false;
        }
      }}
      // Only reached once the change is accepted
      onTasksChange={setTasks}
    />
  );
}
```

The payload:

```ts
interface GanttTaskChange {
  type: 'move' | 'resize' | 'progress';
  task: Task;             // the bar the user grabbed, in its new shape
  changedTasks: Task[];   // every task this gesture rewrites (a summary drag carries its subtree)
  previousTasks: Task[];  // the same tasks before the gesture, index for index
  tasks: Task[];          // the full array onTasksChange would receive
  edge?: 'start' | 'end'; // resize only
}
```

Dragging a summary bar moves its whole subtree, so `changedTasks` holds every descendant —
one handler call, one veto decision, one `onTasksChange` for the lot.

`onBeforeTaskChange` covers the timeline gestures: move, resize and progress. Dropping a
task-list row has its own veto, [`onReorder`](#row-reordering), which is synchronous — the
row is only committed once it returns.

### How this composes with undo

[Undo](#undoredo) records what reached the data, so a change that was never written is
never a step:

- **A vetoed change records nothing.** The bar rolls back and `canUndo` is unchanged.
- **A superseded change records nothing.** A late answer whose lane a newer gesture has
  claimed is dropped, so it never becomes a step either.
- **An approved change records exactly one step, when it commits** — not when the pointer
  went up. The step is diffed against the tasks as they are at that moment, the same
  array the commit merges into, so undoing a slow change writes back what it actually
  replaced and leaves a bar that committed in the meantime alone.
- **Undo and redo do not re-enter `onBeforeTaskChange`.** They restore a state the host
  already accepted (it received an `onTasksChange` for it), and a veto there would pop a
  step without restoring the data and leave the stack describing something that never
  happened. Undo is history playback, not a new proposal.

## Custom Rendering

### Per-task color and class

```tsx
const tasks: Task[] = [
  { id: '1', name: 'Design', color: '#7c3aed', className: 'is-critical', /* ... */ },
];
```

`color` takes any CSS color. The progress fill and the hover shade are derived from it, so
one value colors the whole bar; without it the `--gantt-*` theme tokens decide as before.
`className` lands on the bar and on the task's row in the list pane.

### Render props

Each of these replaces the default node completely.

```tsx
<ReactGanttChart
  tasks={tasks}
  // Spread barProps to keep positioning, dragging, clicks and double clicks working
  renderBar={({ task, width, progress, isSelected, barProps }) => (
    <div {...barProps} className={`my-bar${isSelected ? ' is-selected' : ''}`}>
      <span style={{ width: `${progress ?? 0}%` }} className="my-fill" />
      {width > 80 ? task.name : null}
    </div>
  )}
  // reason is 'hover' while pointing at a bar, or the gesture in progress
  renderTooltip={({ task, reason, startDate, endDate, durationMs }) =>
    reason === 'hover' ? (
      <div className="my-tip">
        {task.name} · {Math.round(durationMs / 86_400_000)}d
      </div>
    ) : (
      <div className="my-tip">
        {startDate.format('MMM D')} → {endDate.format('MMM D')}
      </div>
    )
  }
  // row is 'top' for the merged group labels, 'bottom' for the time ticks
  renderHeaderCell={({ row, label, date, cellProps }) => (
    <div {...cellProps} title={date.toISOString()}>
      {row === 'top' ? label.toUpperCase() : label}
    </div>
  )}
/>
```

- `renderBar` receives `task`, `left`, `width`, `height`, `progress`, `scale`, `isMilestone`,
  `isSummary`, `isDragging`, `isSelected` and `barProps`. It owns the whole bar, tooltip
  included — render a `.gantt-bar-tooltip` child yourself if you want one.
- `renderTooltip` receives `task`, `reason`, `startDate`, `endDate`, `durationMs`, `progress`
  and `scale`. The dates are the live values while a gesture is running.
- `renderHeaderCell` receives `row`, `date`, `label`, `width`, `scale` and `cellProps`.
  Spreading `cellProps` keeps the header layout intact.

A hover tooltip (name, dates, duration, progress) is on by default. `showTooltip={false}`
turns off both it and the drag tooltip.

## Editing dependencies

Hovering a bar reveals a connector dot at each end. Dragging from one dot to another bar
draws the link; a dashed rubber band follows the pointer and the bar under it is outlined.

**The direction of the gesture is the direction of the dependency**: the bar the drag starts
on becomes the predecessor, the bar it is dropped on the successor (the one whose
`dependencies` array gains the entry). Which end each side is connected at decides the type:

| Drag starts at | Dropped on the target's | Type |
|---|---|---|
| the predecessor's **end** | **start** half | `FS` |
| the predecessor's **start** | **start** half | `SS` |
| the predecessor's **end** | **end** half | `FF` |
| the predecessor's **start** | **end** half | `SF` |

Self-links, links that already exist and links that would close a cycle (direct or through
any chain) are rejected **during** the drag: the rubber band and the target turn red and name
the reason, and releasing there commits nothing. `Escape` cancels the drag.

Clicking an arrow selects it. `Delete` / `Backspace` removes it, as does the ✕ that appears on
the selected arrow; `Escape` or a click elsewhere deselects. Keystrokes are ignored while the
focus is in an input, textarea, select or contenteditable, so the host's own forms keep their
keys.

```tsx
<ReactGanttChart
  tasks={tasks}
  onTasksChange={setTasks}
  onDependencyCreate={({ predecessorId, successorId, type }) => {
    if (type === 'SF') return false;      // reject: nothing is applied
    void api.link(predecessorId, successorId, type);
  }}
  onDependencyDelete={({ predecessorId, successorId }) =>
    window.confirm(`Unlink ${predecessorId} → ${successorId}?`)
  }
/>;
```

Both callbacks run **before** anything changes and cancel the edit by returning `false`.
Accepted edits arrive as a whole new array through `onTasksChange`, exactly once per gesture.

```ts
interface GanttDependencyChange {
  predecessorId: string;  // the bar the drag started on
  successorId: string;    // the bar it landed on - its dependencies array changes
  type: DependencyType;
}
```

## Drawing a task

With `onTaskCreate` given, dragging horizontally across the empty part of a row draws a ghost
bar snapped to the current scale's ticks (days on the month scale, months on the year scale,
and so on) and hands the range to the host on release:

```tsx
<ReactGanttChart
  tasks={tasks}
  onTaskCreate={({ startDate, endDate, rowTaskId }) => {
    const name = window.prompt('Task name');
    if (!name) return;                    // veto: nothing is added
    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), name, startDate, endDate, parentId: null, sequence: `${current.length + 1}` },
    ]);
  }}
/>;
```

**The chart never adds the task itself** - it only proposes one, and the row appears when the
host passes the new `tasks` array back in. A drag shorter than 4px counts as a click and
proposes nothing, and a chart with no tasks has no rows to draw on.

```ts
interface GanttTaskDraft {
  startDate: string;         // UTC ISO, snapped to the current scale
  endDate: string;
  rowTaskId: string | null;  // the task whose row was drawn on - useful for parentId/sequence
}
```

## Scheduling

Four features share one engine, and **every one of them is off by default** — a chart that
passes today's props behaves exactly as it did before.

```tsx
<ReactGanttChart
  tasks={tasks}
  onTasksChange={setTasks}
  schedulingPolicy="shift-on-overlap"
  workingCalendar
  criticalPath
/>
```

### Auto-scheduling

Dragging a task propagates through its dependency graph in one topological forward pass:
each link asks for the smallest whole-day shift that satisfies it, the largest of a task's
links wins, and the task moves by that many days. Times of day and durations survive
untouched. Successors preview live during the drag and land in a **single** `onTasksChange`
call on drop.

| `schedulingPolicy` | Behaviour |
|---|---|
| `"off"` (default) | Nothing propagates. Only the dragged task moves. |
| `"shift-on-overlap"` | A successor is pushed later only when the link would otherwise break. It is never pulled earlier. |
| `"maintain-gap"` | A successor sits at its earliest legal date, following the predecessor both ways, so the gap stays equal to the link's `lag`. |

A task's `dependencies` list its **predecessors**, and `lag` is signed — positive waits,
negative overlaps:

| Type | Constraint |
|---|---|
| `FS` | successor start ≥ predecessor finish + lag |
| `SS` | successor start ≥ predecessor start + lag |
| `FF` | successor finish ≥ predecessor finish + lag |
| `SF` | successor finish ≥ predecessor start + lag |

`manuallyScheduled: true` pins a task: the engine never moves it, though its dates still
constrain everything downstream. Summary rows are pinned too when `hierarchy` is on —
their dates come from their children.

**Cycles never hang the engine.** They are detected before any propagation, reported
through `onSchedulingCycle`, and the tasks caught in one are skipped while the rest of the
project still schedules. Better still, keep them out of the data:

```ts
import { canLink } from '@jaeungkim/gantt-chart';

const { ok, cycle } = canLink(tasks, predecessorId, successorId);
if (!ok) alert(`That link would create a loop: ${cycle.join(' → ')}`);
```

### Working-day calendar

`workingCalendar` routes every date calculation through a calendar that skips non-working
days: durations, dependency lag, propagation and drag snapping all count working days, and
a drop always lands on one. Bars still *span* a weekend — the days simply do not count.

The calendar is built from the same `holidays` / `isNonWorkingDay` configuration that
shades the timeline, so what is shaded and what is skipped cannot drift apart:

```tsx
<ReactGanttChart
  tasks={tasks}
  workingCalendar
  holidays={['2026-09-21', '2026-09-22']}
/>
```

Off, the calendar counts every day — which is why plain calendar-date behaviour is not a
special case in the code, just this same engine with a calendar that skips nothing.

### Critical path and slack

`criticalPath` runs a CPM forward and backward pass. Each task's own dates act as a "start
no earlier than" constraint, so the forward pass only ever pushes a task later; the
backward pass then works out how much later it could still finish without moving the
project's end.

Zero-total-slack tasks get a `critical` class, and so do the links that actually bind them
(a slack link between two critical tasks is not part of the chain). A task at 100%
`progress` is never critical — it cannot delay anything. Restyle it with the CSS tokens:

```css
.gantt-container {
  --gantt-critical: #dc2626;
  --gantt-critical-bg: #fecaca;
}
```

The numbers also land on every row as read-only fields, so a `columns` renderer can show
them:

```tsx
const columns: GanttColumn[] = [
  { key: 'name', header: 'Task', width: 220 },
  { key: 'duration', header: 'Days', width: 60, render: (t) => t.duration },
  { key: 'totalSlack', header: 'Slack', width: 60, render: (t) => t.totalSlack },
];
```

`totalSlack`, `freeSlack`, `duration` (working days when the calendar is on), and
`earlyStart` / `earlyFinish` / `lateStart` / `lateFinish` as UTC ISO strings.

### Baselines

`baselineStart` / `baselineEnd` draw a thin snapshot bar under the live one, and a small
diamond for a milestone. The element belongs to the row rather than to the bar, so dragging
slides the live bar across a baseline that stays put — which is the point of having one.
Colour comes from `--gantt-baseline-bg`, or replace the element with `renderBaseline`.

### Worked example

```tsx
const tasks: Task[] = [
  { id: 'a', name: 'Kickoff',       startDate: '2026-08-31T09:00:00Z', endDate: '2026-08-31T17:00:00Z',
    parentId: null, sequence: '1' },
  { id: 'b', name: 'Content audit', startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-04T17:00:00Z',
    parentId: null, sequence: '2',
    baselineStart: '2026-09-01T09:00:00Z', baselineEnd: '2026-09-03T17:00:00Z',
    dependencies: [{ targetId: 'a', type: 'FS' }] },
  { id: 'c', name: 'Visual design', startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-02T17:00:00Z',
    parentId: null, sequence: '3',
    dependencies: [{ targetId: 'a', type: 'FS' }] },
  { id: 'd', name: 'Build',         startDate: '2026-09-05T09:00:00Z', endDate: '2026-09-09T17:00:00Z',
    parentId: null, sequence: '4',
    dependencies: [{ targetId: 'b', type: 'FS' }, { targetId: 'c', type: 'FS', lag: 1 }] },
];
```

`b` hands straight over to `d`, so that link is tight. `c` finishes a day early and its link
carries a day of lag, which leaves it a day of room.

With `schedulingPolicy="shift-on-overlap"`:

| Drag | What moves |
|---|---|
| **Content audit** +3 days | **Build** +3 days — it is the binding predecessor |
| **Visual design** +1 day | nothing; the day of float absorbs it |
| **Visual design** +3 days | **Build** +2 days — the float, then the overflow |

With `criticalPath` on: `a → b → d` all have zero total slack and get the `critical` class,
along with the `a → b` and `b → d` links. **Visual design** has `totalSlack: 1` and stays
grey.

Turn `workingCalendar` on and **Build** — which runs Saturday to Wednesday — reports a
duration of 3 working days instead of 4 calendar days, while a drag that would drop a task
on a Saturday lands on the Monday instead.

### Headless core

All of the above is plain data and pure functions under `src/core/` — no React, no DOM, no
pixels. It is exported from the package, so a server, a worker or a test can schedule
without rendering anything:

```ts
import {
  scheduleTasks,
  computeCriticalPath,
  createWorkingCalendar,
  canLink,
} from '@jaeungkim/gantt-chart';

const calendar = createWorkingCalendar({ holidays: ['2026-09-21'] });

const { tasks: rescheduled, movedIds, cycle } = scheduleTasks(tasks, {
  policy: 'shift-on-overlap',
  calendar,
  seeds: ['b'],          // only what 'b' reaches is touched
});

const { metrics, criticalTaskIds, projectFinish } = computeCriticalPath(tasks, { calendar });
```

`forwardPass` and `backwardPass` are exported separately for anyone who wants half of CPM.

## Imperative API

Pass a ref to scroll the chart programmatically, export it as a PNG, or drive undo/redo:

```tsx
import { useRef } from 'react';
import { ReactGanttChart, type GanttHandle } from '@jaeungkim/gantt-chart';

const ref = useRef<GanttHandle>(null);

<ReactGanttChart ref={ref} tasks={tasks} initialScrollTo="today" />;

ref.current?.scrollToToday();
ref.current?.scrollToDate('2026-09-01');
ref.current?.scrollToTask('task-42', { smooth: false, align: 'start' });
ref.current?.undo();
ref.current?.redo();
ref.current?.canUndo; // boolean
ref.current?.canRedo; // boolean
ref.current?.zoomToFit();
ref.current?.getScrollElement();
```

| Method | What it does |
|--------|--------------|
| `scrollToDate(date, options?)` | Scroll horizontally to a date |
| `scrollToToday(options?)` | Scroll horizontally to today |
| `scrollToTask(taskId, options?)` | Scroll to a task, vertically too when its row is off-screen |
| `zoomToFit()` | Switch to the finest scale at which the whole project fits the viewport width, and scroll it into view |
| `getScrollElement()` | The scroll container DOM node, or `null` |
| `undo()` / `redo()` | Step back/forward through the gesture history ([undo/redo](#undoredo)) |
| `canUndo` / `canRedo` | Whether a step is available in that direction |

`options` is `{ smooth?: boolean; align?: 'start' \| 'center' }`.

Dates outside the rendered timeline and unknown task ids are ignored rather than throwing, so calls during data loading are safe. `scrollToTask` only moves vertically when the row is off-screen. `zoomToFit` does nothing while there are no tasks.

### Undo/redo

Every completed gesture — a move, a resize, a progress drag, a row reorder — is one
undo step, however many rows it changed. Dragging a summary row moves its whole subtree
and one undo puts every task in it back; a reorder renumbers `sequence` across the array
and one undo puts all of it back. Undo and redo write through the chart the same way a
drag does, so `onTasksChange` fires with the restored data.

A step is recorded when the change is *written*, so a gesture your
[`onBeforeTaskChange`](#how-this-composes-with-undo) vetoed or superseded never enters
the stack, and one it approved asynchronously enters it once, at the moment it commits.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |

The shortcuts are scoped to the chart: they fire only for key presses inside it, and
never when the key went to an `<input>`, `<textarea>`, `<select>` or contenteditable —
so a text field in a custom column keeps its own undo. Clicking anywhere in the chart
puts the shortcuts in scope; the container is focusable but not in the tab order.

`canUndo` / `canRedo` are read fresh on every access, and every change to them is
accompanied by an `onTasksChange`, so a toolbar built on them stays in sync by
re-rendering on that callback:

```tsx
<button onClick={() => ref.current?.undo()} disabled={!ref.current?.canUndo}>
  Undo
</button>
```

`historyLimit` sets the depth (default 100; `0` disables recording). Lowering it drops
the steps that no longer fit.

**How the `tasks` prop interacts with the history.** The chart already ignores prop
updates whose content matches what it holds, so the array a controlled parent hands
back after `onTasksChange` is recognized as an echo and changes nothing — including the
history. A prop update with *different* content is the host replacing the data, and
**that clears both stacks**: the recorded steps describe rows and dates that are no
longer on screen, and replaying them would write stale values back. So undo covers what
the user did to the data the host gave it, never across a host-driven reload.

Two consequences worth knowing:

- A controlled parent that normalizes or re-serializes dates before passing them back
  will not produce a byte-identical echo, and every gesture will clear the history it
  just recorded. Pass back what `onTasksChange` handed you.
- A gesture that adds or removes rows cannot be expressed as a field patch. None do
  today; if one is added, it clears the history rather than record a step that would
  corrupt the data on replay.

### PNG export

`exportToPng` renders the **whole** chart — every row, arrow and header cell, not only what happens
to be on screen — and resolves with a `Blob`. Nothing is downloaded for you; what to do with the
blob is your call.

```tsx
const blob = await ref.current!.exportToPng();

// Save it
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'gantt.png';
link.click();
URL.revokeObjectURL(url);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pixelRatio` | `number` | `2` | Output density. Reduced automatically when the canvas would exceed the browser's limits. |
| `background` | `string` | resolved theme background | Any CSS colour. The default is what keeps a dark-theme export dark instead of transparent. |
| `range` | `{ from, to }` | whole timeline | Clips the export horizontally. Dates outside the timeline are clamped to its edges. |

```tsx
const q3 = await ref.current!.exportToPng({
  range: { from: '2026-07-01', to: '2026-09-30' },
  pixelRatio: 3,
  background: '#ffffff',
});
```

The promise rejects with a readable `Error` when no chart is mounted, when the chart has no timeline
yet, when the requested range misses the timeline entirely, or when the canvas comes back tainted.

#### PDF

There is no PDF export and no PDF dependency here — a PNG is a few lines away from a PDF with
[jsPDF](https://github.com/parallax/jsPDF), which many apps already ship:

```ts
import { jsPDF } from 'jspdf';

const blob = await ref.current!.exportToPng();
const { width, height } = await createImageBitmap(blob);
const dataUrl = await new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.readAsDataURL(blob);
});

const pdf = new jsPDF({
  orientation: width > height ? 'landscape' : 'portrait',
  unit: 'px',
  format: [width, height],
});
pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
pdf.save('gantt.pdf');
```

#### How it works, and what it cannot do

The chart is DOM, not canvas. The export clones the chart's subtree, inlines the computed styles it
actually uses, hands the clone to the browser through `<svg><foreignObject>`, and draws the result
into a `<canvas>`. No extra dependency, nothing fetched over the network. The trade-offs are real
and worth knowing:

- **Virtualization is switched off for the capture.** For a handful of frames the chart renders every
  row and header cell, so a very large chart costs noticeably more memory while the export runs.
  Scroll position and the live DOM are restored afterwards, including when the capture throws.
- **CSS pseudo-elements are not captured.** Nothing visible in a resting chart uses them (the bar's
  resize grips only fade in on hover), but a custom stylesheet drawing with `::before`/`::after`
  will lose that decoration.
- **Only fonts already available to the browser render.** `foreignObject` rasterization cannot fetch
  a webfont, so overriding `--gantt-font-sans` with a downloaded font falls back to a system font in
  the export. The bundled stylesheet loads no remote fonts, which is also what keeps the canvas
  untainted.
- **Very large charts are downscaled, not cropped.** A canvas is capped at roughly 16384px per side;
  `pixelRatio` is lowered to fit. Use `range` for a full-density export of one slice.
- **Chromium is what this is verified on.** `foreignObject` rasterization is the least uniform corner
  of the platform — Safari has a history of tainting the canvas for SVG images, in which case the
  promise rejects with a clear error rather than handing back a broken PNG.

## Task Format

All dates must be in **UTC ISO string format**: `"2024-06-01T09:00:00Z"`

```ts
interface Task {
  id: string;
  name: string;
  startDate: string;    // UTC ISO string
  endDate: string;      // UTC ISO string
  parentId: string | null;
  sequence: string;
  type?: 'task' | 'milestone';   // milestones render as a diamond at startDate
  progress?: number;             // 0-100, draws a fill inside the bar
  color?: string;                // any CSS color; the fill and hover shade derive from it
  className?: string;            // added to this task's bar and its task-list row
  lane?: string;                 // share a row with the other tasks in this lane
  dependencies?: TaskDependency[];

  // Per-task interaction overrides - each one wins over the chart-level prop
  readOnly?: boolean;
  allowMove?: boolean;
  allowResize?: boolean;
  allowProgressChange?: boolean;
  allowLinkCreate?: boolean;
  allowLinkDelete?: boolean;
  minDate?: string;              // UTC ISO string
  maxDate?: string;              // UTC ISO string

  // Scheduling - all inert until the matching prop is on
  manuallyScheduled?: boolean;   // the scheduling engine never moves this task
  baselineStart?: string;        // UTC ISO string - draws a thin planned bar underneath
  baselineEnd?: string;          // UTC ISO string
}

interface TaskDependency {
  targetId: string;              // the PREDECESSOR - a task lists what it waits on
  type: DependencyType;
  lag?: number;                  // signed days; negative is a lead (overlap)
}

type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
// FS = Finish-to-Start
// SS = Start-to-Start
// FF = Finish-to-Finish
// SF = Start-to-Finish
```

### Time zone

**The chart draws and labels the timeline in UTC.** The grid, the bars, the tick and header
labels, and the drag tooltips all use UTC, so the same tasks render identically for every
viewer — a chart shared between Seoul and London puts every bar on the same day cell.
`onTasksChange` hands back UTC ISO strings (`2024-06-01T09:00:00.000Z`).

- A string with a zone (`"2024-06-01T09:00:00Z"`, `"2024-06-01T18:00:00+09:00"`) is that
  instant, shown at its UTC clock time — both examples render at `09:00`.
- A string without a zone (`"2024-06-01"`, `"2024-06-01T09:00"`) is read as UTC wall clock,
  so it renders exactly as written and lands on the day it names, wherever the viewer is.

`holidays` entries are UTC days too, and the `Dayjs` handed to `isNonWorkingDay` is in UTC mode,
so `date.day()` inside it is the UTC weekday.

Want the chart to read in your own zone instead? Convert to that zone's wall clock and drop
the offset before passing the tasks in (e.g. `"2024-06-01T18:00"` for 18:00 KST), and convert
back in `onTasksChange`. There is no per-viewer local-time mode: local rendering would move
bars between day cells depending on where the viewer sits, and local DST days (23 or 25 hours
long) would make a one-day drag land an hour off the day it was dropped on.

## Timeline Scales

Six scales, finest first. The top header row groups the ticks; the bottom row is one label
per tick. Drag steps are what a bar snaps to while it is moved or resized.

| Scale | Top row (example) | Tick (example) | Tick width | Drag step |
|-------|-------------------|----------------|-----------:|-----------|
| `hour` | Day — `Sep 1, 2025` | Hour — `15:00` | 120px | 15 minutes |
| `day` | Day — `Sep 1, 2025` | Hour — `15` | 32px | 1 hour |
| `week` | Month — `Sep 2025` | Day — `1` | 216px | 6 hours |
| `month` | Month — `Sep 2025` | Day — `1` | 32px | 1 day |
| `quarter` | Quarter — `Q3 2025` | Month — `Sep` | ~240px | 3 days |
| `year` | Year — `2025` | Month — `Sep` | ~120px | 7 days |

Hour and day both tick once an hour: the hour scale is four times as wide and drags in
quarter-hours, the day scale is the compact overview. Quarter and year both tick once a
month, and the quarter scale is twice as wide. Month cells are sized by the real length of
the month, so tick widths there are approximate.

Switch scales with the segmented control at the top-right of the chart. The choice is kept
in `sessionStorage` (see `storageKey`).

The bottom row is column-virtualized, so a long range at hour granularity stays cheap: 150
days of tasks is 3,762 hour cells, of which about 25 are in the DOM at a time.

## Zooming

`zoomOnWheel` turns Ctrl/Cmd + wheel into a zoom: each gesture moves one step along the
scale ladder and the date under the cursor stays exactly where it is, so you zoom into what
you are pointing at rather than into the middle of the chart. Plain wheel still scrolls
vertically and Shift + wheel horizontally — those are never taken over. One gesture is one
step, however many events a trackpad pinch fires.

```tsx
<ReactGanttChart tasks={tasks} zoomOnWheel />
```

It is off by default because Ctrl + wheel is the browser's own page zoom; turning it on
takes that over inside the chart. The scale selector stays in sync either way.

`zoomToFit()` on the [imperative handle](#imperative-api) picks the finest scale at which
the whole project fits the viewport width and scrolls the project into view. With the task
list pane open, "viewport width" means the timeline area, not the whole container.

## Infinite range

By default the timeline covers the tasks plus a small buffer and stops there. With
`infiniteScroll`, scrolling — or dragging a bar — towards either end extends the rendered
range by about a viewport at a time instead of hitting a wall. What you are looking at does
not move while this happens: when the range grows at the front, the scroll position is
compensated by exactly the width that was added.

`onRangeChange` fires whenever the rendered range changes — the hook for loading tasks
lazily for the window that just became reachable. It also fires on the first render and on
every scale change, so it is a complete picture of what is on screen, not only of
extensions.

```tsx
<ReactGanttChart
  tasks={tasks}
  infiniteScroll
  onRangeChange={({ start, end }) => loadTasksBetween(start.toDate(), end.toDate())}
/>
```

`start` and `end` are UTC `Dayjs` values. Extension is capped at 2000 ticks per side, so a
runaway scroll cannot grow the timeline without bound.

Dragging a bar towards a viewport edge scrolls the timeline on its own, faster the closer
the pointer gets, and stops on drop or cancel — including while an
[`onBeforeTaskChange`](#cancellable-changes-and-optimistic-updates) veto is still pending, where the pointer is
already up. That one is on by default; pass `autoScrollOnDrag={false}` to turn it off.

A discarded gesture takes its scrolling with it: when a drag is cancelled, or rolled back
because the before-handler said no, the timeline scrolls back by however far the
auto-scroll carried it, so the bar sliding home is still the thing you are looking at. The
undo is relative, so a manual scroll made while the veto was in flight survives it.

## Markers and range bands

`markers` draws labelled vertical lines at given dates and `rangeBands` shades date ranges.
The built-in today line is one of these markers, so anything below styles it the same way.

```tsx
<ReactGanttChart
  tasks={tasks}
  markers={[
    { id: 'launch', date: '2026-10-01', label: 'Launch', color: '#10b981' },
    { id: 'due', date: '2026-09-20', label: 'Due', warnOnOverrun: true, taskIds: ['task-42'] },
  ]}
  rangeBands={[
    { id: 'sprint-7', startDate: '2026-09-14', endDate: '2026-09-28', label: 'Sprint 7' },
  ]}
/>
```

| `GanttMarker` | Type | Description |
|---------------|------|-------------|
| `date` | `string \| Date \| Dayjs` | Where the line goes |
| `id` | `string` | React key (default: the date) |
| `label` | `string` | Text at the top of the line; omitted, the line is bare |
| `className` | `string` | Extra class on the marker element |
| `color` | `string` | Any CSS color — wins over the class and the theme default |
| `warnOnOverrun` | `boolean` | Set `data-warning="true"` once a task ends past the date |
| `taskIds` | `string[]` | Limits the overrun check to these tasks (default: all of them) |

`GanttRangeBand` takes `startDate`, `endDate`, and the same `id` / `label` / `className` /
`color`. Markers and bands outside the rendered range are dropped, and a band that only
overlaps it is clipped.

Colours come from `--gantt-marker`, `--gantt-marker-warning` and `--gantt-band-bg`, so a
whole palette can be set once in CSS instead of per marker.

## i18n and date formats

Pass a `locale` and every label — tick, header and drag tooltip — is rendered with
`Intl.DateTimeFormat`. Nothing to install: the browser already ships the locale data, so
there are no dayjs locale packages and no bundle cost per language.

```tsx
<ReactGanttChart tasks={tasks} locale="ko-KR" firstDayOfWeek={1} />
```

| Scale | `locale` unset (default) | `"en-US"` | `"ko-KR"` |
|-------|--------------------------|-----------|-----------|
| `hour` | `Sep 1, 2025` / `15:00` | `Sep 1, 2025` / `15:00` | `2025년 9월 1일` / `15:00` |
| `day` | `Sep 1, 2025` / `15` | `Sep 1, 2025` / `15` | `2025년 9월 1일` / `15시` |
| `week`, `month` | `Sep 2025` / `1` | `Sep 2025` / `1` | `2025년 9월` / `1일` |
| `quarter` | `Q3 2025` / `Sep` | `Q3 2025` / `Sep` | `2025년 Q3` / `9월` |
| `year` | `2025` / `Sep` | `2025` / `Sep` | `2025년` / `9월` |

**Leaving `locale` out changes nothing** — the labels are the built-in English ones, byte
for byte, and no `Intl` formatter is created. A malformed tag falls back to them and warns
once instead of breaking the chart.

Labels are always rendered in UTC, matching the grid (see [Time zone](#time-zone)).

### Per-scale overrides

`formats` replaces individual labels and wins over `locale`. `Intl` exposes no quarter
field, so the built-in quarter header is `Q3 2025` (`2025년 Q3` in Korean) — this is the
place to make it idiomatic:

```tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';

<ReactGanttChart
  tasks={tasks}
  locale="ko-KR"
  firstDayOfWeek={1}
  formats={{
    // 2025년 3분기
    quarter: { header: (d) => `${d.year()}년 ${Math.floor(d.month() / 3) + 1}분기` },
    // 9/1 instead of 1일
    week: { tick: (d) => d.format('M/D') },
  }}
/>;
```

Each scale takes `tick` (bottom row), `header` (top row) and `tooltip` (drag tooltip and
guides); anything left out keeps the locale's label. The `Dayjs` passed in is in UTC mode.

### First day of the week

`firstDayOfWeek` (0 = Sunday .. 6 = Saturday) groups the **week scale's** top header by
week instead of by month, labelling each group with its first day:

```tsx
<ReactGanttChart tasks={tasks} firstDayOfWeek={1} />
// week scale headers: Sep 1, 2025 | Sep 8, 2025 | Sep 15, 2025 ...
```

Left out, the week scale keeps grouping by month. It is the only setting that changes week
boundaries; weekend shading is Saturday/Sunday regardless (override it with
`isNonWorkingDay`).

The scale selector's own button text (`hour`, `day`, ...) is not localized yet.

## Theming

Set the `theme` prop to `light`, `dark`, or `system` (the default follows the OS setting).

All colors are CSS custom properties scoped to `.gantt-container` and prefixed with `--gantt-`,
so they never collide with your app's own tokens. Override any of them from your own stylesheet:

```css
.gantt-container {
  --gantt-bar-bg: #dbeafe;
  --gantt-bar-text: #1e3a8a;
  --gantt-accent: #2563eb;
  --gantt-font-sans: "Inter", sans-serif;
}
```

The stylesheet loads no remote fonts; it uses the system font stack unless you override
`--gantt-font-sans`.

## Roadmap

- [x] Left sidebar for task names
- [ ] Right sidebar for task details
- [x] Collapsible parent-child rows
- [ ] Inline editing for task names
- [x] Export to PNG ([`exportToPng`](#png-export)) — SVG still open
- [x] Undo/redo ([`undo` / `redo`](#undoredo))
- [x] Touch gestures ([touch](#touch))
- [x] Custom bar colors
- [x] Keyboard-accessible scale selector
- [x] Keyboard navigation and ARIA treegrid ([keyboard map](#keyboard-and-screen-readers))
- [x] Grouping and swimlanes ([`groupBy`](#grouping-and-swimlanes))
- [x] Auto-scheduling, working-day calendar, critical path, baselines ([scheduling](#scheduling))
- [ ] Per-task and per-resource calendars

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
