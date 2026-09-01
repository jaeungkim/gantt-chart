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
- 🔄 Drag-and-drop support:
  - Move entire task bars
  - Resize from left/right edges
  - Snap to configured intervals
- 🧲 Smart dependency arrows (FS, SS, FF, SF)
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

- [ ] Left sidebar for task names
- [ ] Right sidebar for task details
- [ ] Collapsible parent-child rows
- [ ] Inline editing for task names
- [ ] Export to PNG/SVG
- [ ] Custom bar colors

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
