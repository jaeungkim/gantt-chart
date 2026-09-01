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
- 📆 Multiple timeline scales: Day, Week, Month, Year
- 🔄 Drag-and-drop support:
  - Move entire task bars
  - Resize from left/right edges
  - Snap to configured intervals
- 🧲 Smart dependency arrows (FS, SS, FF, SF)
- ◆ Milestones and per-task progress
- 🗓️ Weekend and holiday shading
- 🔍 Cursor-anchored Ctrl/Cmd + wheel zoom, plus `zoomToFit()`
- ♾️ Range that extends as you scroll or drag past its end, with an `onRangeChange` hook
- ⚡ Virtualized rendering for performance
- 🌙 Light/Dark/System theme support
- 📍 Today marker, custom date markers and shaded range bands
- 💬 Drag tooltip showing date changes
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
| `markers` | `GanttMarker[]` | - | Labelled vertical lines at given dates ([markers](#markers-and-range-bands)) |
| `rangeBands` | `GanttRangeBand[]` | - | Shaded bands covering a date range |
| `zoomOnWheel` | `boolean` | `false` | Ctrl/Cmd + wheel steps through the scale ladder ([zoom](#zooming)) |
| `infiniteScroll` | `boolean` | `false` | Extend the rendered range when scrolling or dragging past an end |
| `onRangeChange` | `(range: GanttDateRange) => void` | - | Fires whenever the rendered timeline range changes |
| `autoScrollOnDrag` | `boolean` | `true` | Scroll the timeline when a bar drag reaches a viewport edge |

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

## Imperative API

Pass a ref to scroll the chart programmatically:

```tsx
import { useRef } from 'react';
import { ReactGanttChart, type GanttHandle } from '@jaeungkim/gantt-chart';

const ref = useRef<GanttHandle>(null);

<ReactGanttChart ref={ref} tasks={tasks} initialScrollTo="today" />;

ref.current?.scrollToToday();
ref.current?.scrollToDate('2026-09-01');
ref.current?.scrollToTask('task-42', { smooth: false, align: 'start' });
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

`options` is `{ smooth?: boolean; align?: 'start' \| 'center' }`.

Dates outside the rendered timeline and unknown task ids are ignored rather than throwing, so calls during data loading are safe. `scrollToTask` only moves vertically when the row is off-screen. `zoomToFit` does nothing while there are no tasks.

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
the pointer gets, and stops on drop or cancel. That one is on by default; pass
`autoScrollOnDrag={false}` to turn it off.

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
- [ ] Export to PNG/SVG
- [ ] Custom bar colors

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
