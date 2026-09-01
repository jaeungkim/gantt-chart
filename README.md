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
- 🧲 Smart dependency arrows (FS, SS, FF, SF)
- ◆ Milestones and per-task progress
- 🖱️ Click / double-click / select events with a visible selection highlight
- ↩️ Cancellable before-events: veto a move, resize or progress change and the bar rolls back
- 🎨 Per-task color and class name, plus `renderBar` / `renderTooltip` / `renderHeaderCell` overrides
- 🗓️ Weekend and holiday shading
- ⚡ Virtualized rendering for performance
- 🌙 Light/Dark/System theme support
- 📍 Today marker indicator
- 💬 Hover and drag tooltips
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
| `onTaskClick` | `(task, event) => void` | - | A bar or task-list row was clicked. Not fired for the click that ends a drag |
| `onTaskDoubleClick` | `(task, event) => void` | - | A bar or row was double-clicked |
| `onTaskSelect` | `(task \| null) => void` | - | The selection changed; `null` when the empty timeline is clicked. Passing it turns selection on |
| `selectable` | `boolean` | `onTaskSelect !== undefined` | Selection highlight without a callback (`true`), or off entirely (`false`) |
| `onBeforeTaskChange` | `(change) => boolean \| void \| Promise<boolean \| void>` | - | Runs before a move, resize or progress change is written. `false`, a promise resolving to `false`, or a rejection rolls the bar back |
| `renderBar` | `(props) => ReactNode` | - | Replaces the bar node entirely |
| `renderTooltip` | `(props) => ReactNode` | - | Replaces the tooltip node entirely, for hover and drag alike |
| `renderHeaderCell` | `(props) => ReactNode` | - | Replaces a timeline header cell entirely; both header rows go through it |
| `showTooltip` | `boolean` | `true` | `false` suppresses the hover and drag tooltips |

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
  color?: string;                // any CSS color; the fill and hover shade derive from it
  className?: string;            // added to this task's bar and its task-list row
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

- [x] Left sidebar for task names
- [ ] Right sidebar for task details
- [x] Collapsible parent-child rows
- [ ] Inline editing for task names
- [ ] Export to PNG/SVG
- [x] Custom bar colors

## 🤝 Contributing

Pull requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks.
Bugs and feature requests go in [Issues](https://github.com/jaeungkim/gantt-chart/issues); questions in [Discussions](https://github.com/jaeungkim/gantt-chart/discussions).

## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
