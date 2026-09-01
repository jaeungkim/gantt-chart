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
- 🧲 Smart dependency arrows (FS, SS, FF, SF)
- ◆ Milestones and per-task progress
- 🔒 Read-only mode, per-capability and per-task
- 🚧 Drag bounds and a fixed visible range
- 🗓️ Weekend and holiday shading
- ⚡ Virtualized rendering for performance
- 🌙 Light/Dark/System theme support
- 📍 Today marker indicator
- 💬 Drag tooltip showing date changes
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
| `readOnly` | `boolean` | `false` | Blocks moving, resizing and progress dragging on every task |
| `allowMove` | `boolean` | `true` | Allows/blocks moving bars. Beats `readOnly` |
| `allowResize` | `boolean` | `true` | Allows/blocks resizing bars. Beats `readOnly` |
| `allowProgressChange` | `boolean` | `true` | Allows/blocks dragging the progress handle. Beats `readOnly` |
| `minDate` | `string` | - | Earliest date any bar may be dragged to (UTC ISO string) |
| `maxDate` | `string` | - | Latest date any bar may be dragged to (UTC ISO string) |
| `visibleStart` | `string` | - | Pins the timeline start (UTC ISO string) instead of fitting to the tasks |
| `visibleEnd` | `string` | - | Pins the timeline end (UTC ISO string) instead of fitting to the tasks |
| `allowRowReorder` | `boolean` | `false` | Let a task list row be dragged to reorder siblings and re-parent. Follows `readOnly` / `allowMove` |
| `onReorder` | `(change: GanttReorderChange) => void \| boolean` | - | Fires on a row drop, before anything is committed. Return `false` to cancel |

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

## Interaction Control

### Read-only and per-task capabilities

Every interaction prop has a matching optional field on `Task`, and the task's own
field wins. Resolution runs most specific first:

`task.allowX` > `task.readOnly` > `allowX` prop > `readOnly` prop > allowed

A blocked gesture renders no affordance at all - no grab or resize cursor, no resize
grips, no progress handle - rather than failing on interaction.

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

## Imperative API

Pass a ref to scroll the chart programmatically, or to export it as a PNG:

```tsx
import { useRef } from 'react';
import { ReactGanttChart, type GanttHandle } from '@jaeungkim/gantt-chart';

const ref = useRef<GanttHandle>(null);

<ReactGanttChart ref={ref} tasks={tasks} initialScrollTo="today" />;

ref.current?.scrollToToday();
ref.current?.scrollToDate('2026-09-01');
ref.current?.scrollToTask('task-42', { smooth: false, align: 'start' });
```

Dates outside the rendered timeline and unknown task ids are ignored rather than throwing, so calls during data loading are safe. `scrollToTask` only moves vertically when the row is off-screen.

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
  dependencies?: TaskDependency[];

  // Per-task interaction overrides - each one wins over the chart-level prop
  readOnly?: boolean;
  allowMove?: boolean;
  allowResize?: boolean;
  allowProgressChange?: boolean;
  minDate?: string;              // UTC ISO string
  maxDate?: string;              // UTC ISO string
}

interface TaskDependency {
  targetId: string;
  type: DependencyType;
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
- [ ] Custom bar colors
- [x] Keyboard-accessible scale selector

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
