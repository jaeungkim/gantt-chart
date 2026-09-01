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

- 📆 Multiple timeline scales: Day, Week, Month, Year
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
| `defaultScale` | `"day" \| "week" \| "month" \| "year"` | `"month"` | Initial timeline scale |
| `className` | `string` | - | Additional CSS class for the container |
| `showNonWorkingDays` | `boolean` | `true` | Shade weekends and holidays at day/week scales |
| `holidays` | `string[]` | - | Extra non-working dates, `YYYY-MM-DD` |
| `isNonWorkingDay` | `(date: Dayjs) => boolean` | - | Replaces the default weekend/holiday check entirely |
| `initialScrollTo` | `"today" \| string` | - | Scroll here once after the first render |
| `storageKey` | `string` | `"gantt-scale"` | sessionStorage key for the scale. Give each chart its own key when rendering more than one on a page. |

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

- [ ] Left sidebar for task names
- [ ] Right sidebar for task details
- [ ] Collapsible parent-child rows
- [ ] Inline editing for task names
- [x] Export to PNG ([`exportToPng`](#png-export)) — SVG still open
- [ ] Custom bar colors

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
