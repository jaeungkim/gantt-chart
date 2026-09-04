[![Banner](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/banner.png)](https://gantt.jaeungkim.com)

# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

A Gantt chart for React that you can actually edit. Virtualized rows, four dependency types, a
working-day calendar, keyboard and screen-reader support, and a date core that runs without a DOM.

**[Quick start](https://gantt.jaeungkim.com/docs/quick-start)** ·
**[Playground](https://gantt.jaeungkim.com/playground)** ·
**[Documentation](https://gantt.jaeungkim.com/docs)** ·
**[한국어 문서](https://gantt.jaeungkim.com/ko/docs)**

The package is two layers. `ReactGanttChart` renders the chart, handles every gesture, and hands
your app a new `tasks` array each time an edit commits. The tree and calendar math underneath it is
exported as plain functions, so a server, a worker or a test can call them without rendering
anything.

## Features

### Rendering

- Rows and time cells are virtualized together. Bars outside the window are not mounted.
- Five scales, `day` through `year`, each with its own tick unit, drag step and label format.
- A task list pane on the left with an optional row-number column, behind a draggable splitter.
- `hierarchy` derives depth and summary rows from `parentId`. A summary row's dates and progress
  roll up from its children, and it collapses.
- `lane` packs tasks that never overlap onto one row, side by side.
- Dependency arrows routed as elbows for all four link types: `FS`, `SS`, `FF`, `SF`.
- A today line, weekend and holiday shading, and a hover card per bar.
- A docked detail panel that narrows the timeline instead of covering it. `renderDetail` replaces
  its body; `detailTaskId` controls which task is open.

### Editing

- Drag a bar to move it, pull either edge to resize it, drag the handle to set progress. Touch and
  pen get wider grab zones.
- While a drag is live the dragged dates print in the date-axis cells they land in. Nothing floats
  over the chart.
- Draw a dependency from one bar's link handle to another; click an arrow and press Delete to
  remove it. `onDependencyCreate` and `onDependencyDelete` can veto either.
- Propose a new task from the **Add task** button under the task list, from `addTask()` on the ref,
  or by drawing a range below the last row. The chart reports a draft through `onTaskCreate` and
  never adds the row itself.
- Drag a task-list row to a new position or a new parent with `allowReorder`. `onTaskMove` can
  reject the move.
- The detail panel edits too. Its built-in body changes the name, either date and the progress in
  place, committing through the same `onTasksChange` and gated by the same per-task flags as the
  bar gestures. A `renderDetail` body of your own commits through `update(patch)`.
- Permissions per chart and per task: `readOnly`, `allowMove`, `allowResize`,
  `allowProgressChange`, `allowLinkCreate`, `allowLinkDelete`, `allowTaskCreate`, `allowReorder`,
  plus `minDate` and `maxDate` drag bounds.
- Every committed gesture ends in one `onTasksChange` call with the complete next array.

### Dates

- `workingCalendar` moves a drop forward off a weekend or a holiday. `workingWeekdays` says which
  weekdays are worked and `holidays` lists the days off beyond them; both feed the calendar and the
  shading, so the two cannot drift apart.
- A holiday can carry a `label` and a `color`. The name is written in the tick row over its band and
  the colour tints it, so it reads apart from the weekend beside it.
- `visibleStart` and `visibleEnd` pin the range; `infiniteScroll` grows it at either end and
  `onRangeChange` reports every change.
- Every date is UTC. A bare `YYYY-MM-DD` lands on the day it names in every viewer's time zone.

### Keyboard and screen readers

- The chart is one ARIA treegrid with a single roving tab stop. Arrow keys move between rows and
  cells; Home and End jump.
- Bars move, resize and step their progress from the keyboard. Rows reorder, indent and outdent.
  Ctrl/Cmd + ArrowUp and ArrowDown step the scale, and edits are announced.
- A bar's accessible name is built from the task name, its dates and its progress.
- The gestures with no keyboard equivalent are written down in
  [Keyboard and screen readers](https://gantt.jaeungkim.com/docs/accessibility), not hidden.

### Locale and theme

- `locale` renders every date label through `Intl.DateTimeFormat`. `formats` overrides the tick,
  header and tooltip labels per scale, and `firstDayOfWeek` picks where a week starts. No locale
  package needed.
- `theme` takes `'light'`, `'dark'` or `'system'`. Omitted, the chart follows the host page's
  `color-scheme`, which is what an app's own light/dark toggle already sets.
- 26 `--gantt-*` custom properties scoped to `.gantt-container`, so they cannot collide with your
  own tokens.
- A per-task `color` derives the bar, its progress fill, its hover shade and a readable label color
  from one value. A per-task `className` reaches the bar and its task-list row.

### Imperative API

A `ref` of type `GanttHandle` exposes `scrollToDate`, `scrollToToday`, `scrollToTask`, `setScale`,
`zoomToFit`, `openDetail`, `closeDetail`, `addTask` and `getScrollElement`. The chart renders no
toolbar and no scale picker; you render the control and drive it through the ref.

### Headless core

`buildTaskTree`, `collectSubtreeIds`, `rollUpTasks`, `sortTasksBySequence`, `validateMove`,
`moveTask`, `createWorkingCalendar` and `CALENDAR_DAYS` import no React and touch no DOM. They are
the same functions the chart runs, so a report on the server and the bars in the browser agree.

### Packaging

- TypeScript types for every prop, callback and helper.
- ESM and CJS builds, one stylesheet at `@jaeungkim/gantt-chart/style.css`.
- React 18 and 19 as peer dependencies. Two runtime dependencies: `dayjs` and `zustand`.
- Published from CI with npm provenance.

## Install

```bash
pnpm add @jaeungkim/gantt-chart
# npm install @jaeungkim/gantt-chart
# yarn add @jaeungkim/gantt-chart
```

`react` and `react-dom` (`^18` or `^19`) are peer dependencies.

## Quick example

```tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initialTasks: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    parentId: null,
    sequence: '1',
    progress: 100,
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2026-03-09',
    endDate: '2026-03-20',
    parentId: null,
    sequence: '2',
    progress: 40,
    dependencies: [{ targetId: 'design', type: 'FS' }],
  },
  {
    id: 'ship',
    name: 'Ship',
    startDate: '2026-03-23',
    endDate: '2026-03-23',
    parentId: null,
    sequence: '3',
    dependencies: [{ targetId: 'build', type: 'FS' }],
  },
];

export default function ProjectChart() {
  const [tasks, setTasks] = useState(initialTasks);

  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      height={420}
      showTaskList
      defaultScale="month"
    />
  );
}
```

That chart is already editable. The chart keeps no canonical copy of your data: a committed gesture
ends in one `onTasksChange` call with the complete next array, so your app stays the source of
truth.

### Add a scale control

The chart ships no toolbar, so the scale picker is a control you own: render it, and call `setScale`
on the ref. `onScaleChange` fires for every source, so your control stays in step when Ctrl/Cmd +
wheel or Ctrl/Cmd + arrow moves the scale instead.

The whole recipe is in **[Imperative API](https://gantt.jaeungkim.com/docs/imperative-api)**.

### Use the core without a chart

```ts
import { createWorkingCalendar, rollUpTasks, type Task } from '@jaeungkim/gantt-chart';

const calendar = createWorkingCalendar({ holidays: ['2026-09-21'] });
const rolled = rollUpTasks(tasks); // summary rows recomputed from their children
```

Full walkthroughs: **[Quick start](https://gantt.jaeungkim.com/docs/quick-start)** and
**[Headless core](https://gantt.jaeungkim.com/docs/headless-core)**.

## What it leaves to you

The chart renders the timeline and handles the gestures. Your app owns everything else:

- Data fetching and persistence. Tasks arrive as a prop; nothing is stored, not even the scale.
- Validation. Ids, date order and parseable dates are not checked before render.
- Automatic rescheduling. Moving a predecessor never moves its successors.
- Chrome. No toolbar, scale picker, zoom buttons or collapse button.
- Resources, costs, export and print.

The full boundary list is in
**[Introduction](https://gantt.jaeungkim.com/docs/introduction)**.

## Documentation

| Guide | What it covers |
|---|---|
| [Introduction](https://gantt.jaeungkim.com/docs/introduction) | What the library is, and what it deliberately leaves to you |
| [Concepts and vocabulary](https://gantt.jaeungkim.com/docs/concepts) | Every term the rest of the docs use, defined once |
| [Quick start](https://gantt.jaeungkim.com/docs/quick-start) | Install to a working, editable chart |
| [Task data](https://gantt.jaeungkim.com/docs/task-data) | The `Task` shape, date handling, and how the `tasks` prop is compared |
| [Task list and hierarchy](https://gantt.jaeungkim.com/docs/task-list) | The left pane and the `parentId` tree |
| [Lanes](https://gantt.jaeungkim.com/docs/lanes) | The `lane` task field, which packs tasks that never overlap onto one row |
| [The timeline](https://gantt.jaeungkim.com/docs/timeline) | Scales, range, zoom, the today line, and non-working days |
| [Editing tasks](https://gantt.jaeungkim.com/docs/editing) | Move, resize, progress, permissions, drag bounds, and touch |
| [Creating tasks](https://gantt.jaeungkim.com/docs/task-creation) | The three ways a new task is proposed, and `onTaskCreate` |
| [Reordering rows](https://gantt.jaeungkim.com/docs/reordering) | Dragging a row to a new position or a new parent, and `onTaskMove` |
| [Dependencies](https://gantt.jaeungkim.com/docs/dependencies) | The four link types, and drawing arrows |
| [Working calendar](https://gantt.jaeungkim.com/docs/working-calendar) | Keeping a drop off weekends and holidays |
| [Detail panel](https://gantt.jaeungkim.com/docs/detail-panel) | The docked side panel: what opens it, editing in place, `renderDetail`, and controlling it |
| [Events](https://gantt.jaeungkim.com/docs/events) | Every callback a click, a drag and a keyboard edit fire |
| [Styling](https://gantt.jaeungkim.com/docs/styling) | Per-task color and class names |
| [Imperative API](https://gantt.jaeungkim.com/docs/imperative-api) | The `ref` handle: scrolling, zoom, the detail panel and task creation |
| [Keyboard and screen readers](https://gantt.jaeungkim.com/docs/accessibility) | The key map, the ARIA tree, and the gaps |
| [Locale and date formats](https://gantt.jaeungkim.com/docs/i18n) | `locale`, per-scale overrides, week start |
| [Theming](https://gantt.jaeungkim.com/docs/theming) | The theme prop and the CSS custom properties |
| [Headless core](https://gantt.jaeungkim.com/docs/headless-core) | Tree and calendar math without React or a DOM |

| Reference | Symbols |
|---|---|
| [GanttProps](https://gantt.jaeungkim.com/docs/ref/props) | `GanttProps` |
| [Task and task types](https://gantt.jaeungkim.com/docs/ref/task) | `Task`, `TaskDependency`, `DependencyType`, `TaskTransformed` |
| [GanttInteractionConfig](https://gantt.jaeungkim.com/docs/ref/interaction-config) | `GanttInteractionConfig` |
| [GanttRow](https://gantt.jaeungkim.com/docs/ref/rows) | `GanttRow` |
| [Detail renderer](https://gantt.jaeungkim.com/docs/ref/renderers) | `GanttDetailRenderer`, `GanttDetailRenderProps` |
| [GanttHandle](https://gantt.jaeungkim.com/docs/ref/handle) | `GanttHandle`, `GanttScrollApi`, `GanttDetailApi`, `GanttTaskCreateApi`, `GanttScrollOptions`, `GanttZoomAnchor` |
| [Scale and theme types](https://gantt.jaeungkim.com/docs/ref/scales) | `GanttScaleKey`, `GanttScaleFormat`, `GanttFormatOverrides`, `GanttTheme`, `Holiday` |
| [Tree helpers](https://gantt.jaeungkim.com/docs/ref/core-tree) | `buildTaskTree`, `collectSubtreeIds`, `rollUpTasks`, `moveTask`, `validateMove`, `sortTasksBySequence` |
| [Working calendar helpers](https://gantt.jaeungkim.com/docs/ref/core-calendar) | `createWorkingCalendar`, `CALENDAR_DAYS`, `WorkingCalendar` |

Full docs: **[English](https://gantt.jaeungkim.com/docs)** · **[한국어](https://gantt.jaeungkim.com/ko/docs)**

## Contributing

Setup, the checks CI runs, and the branch and PR conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/jaeungkim/gantt-chart/discussions); issues are for bugs and
concrete feature requests.

## License

[MIT](LICENSE)
