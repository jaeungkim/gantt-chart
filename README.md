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

- 📋 Task list pane with configurable columns, a draggable splitter, and a collapse toggle
- 🌳 Arbitrary-depth tree from `parentId`: expand/collapse, summary bars, subtree drag
- 📆 Multiple timeline scales: Day, Week, Month, Year
- 🔄 Drag-and-drop support:
  - Move entire task bars
  - Resize from left/right edges
  - Snap to configured intervals
- 🧲 Smart dependency arrows (FS, SS, FF, SF) with signed lag/lead
- ⚙️ Auto-scheduling: a drag propagates to successors, with cycle detection
- 🗓️ Working-day calendar: durations, lag and snapping skip weekends and holidays
- 🔺 Critical path and slack (CPM forward + backward pass)
- 📊 Baseline bars: planned vs actual, with a milestone diamond
- ◆ Milestones and per-task progress
- 🗓️ Weekend and holiday shading
- ⚡ Virtualized rendering for performance
- 🌙 Light/Dark/System theme support
- 📍 Today marker indicator
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
| `defaultScale` | `"day" \| "week" \| "month" \| "year"` | `"month"` | Initial timeline scale |
| `className` | `string` | - | Additional CSS class for the container |
| `showNonWorkingDays` | `boolean` | `true` | Shade weekends and holidays at day/week scales |
| `holidays` | `string[]` | - | Extra non-working dates, `YYYY-MM-DD` |
| `isNonWorkingDay` | `(date: Dayjs) => boolean` | - | Replaces the default weekend/holiday check entirely |
| `initialScrollTo` | `"today" \| string` | - | Scroll here once after the first render |
| `storageKey` | `string` | `"gantt-scale"` | sessionStorage key for the scale. Give each chart its own key when rendering more than one on a page. |
| `showTaskList` | `boolean` | - | Show the task list pane. Omitted, the pane appears only when `columns` is given |
| `columns` | `GanttColumn[]` | Name / Start / End | Task list columns. Every header label and cell body comes from here |
| `hierarchy` | `boolean` | `false` | Turn on the `parentId` tree: indentation, expanders, summary bars, subtree drag |
| `collapsedIds` | `string[]` | - | Ids of collapsed parents (controlled) |
| `defaultCollapsedIds` | `string[]` | - | Initial collapsed ids (uncontrolled seed) |
| `onCollapsedChange` | `(ids: string[]) => void` | - | Fires whenever a row is expanded or collapsed |
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

Pass a ref to scroll the chart programmatically:

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

| Scale | Header Label | Tick Unit | Drag Step |
|-------|-------------|-----------|-----------|
| `day` | Day | Hour | 1 hour |
| `week` | Week | Day | 6 hours |
| `month` | Month | Day | 1 day |
| `year` | Year | Month | 7 days |

Switch scales using the dropdown at the top-right of the chart.

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
- [x] Auto-scheduling, working-day calendar, critical path, baselines
- [ ] Per-task and per-resource calendars

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
