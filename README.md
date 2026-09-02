# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

A Gantt chart for React: virtualized rows, editable bars, dependency arrows, and a scheduling
engine that runs without a DOM.

**[Live demo](https://gantt.jaeungkim.com/docs/quick-start)** · **[Documentation](https://gantt.jaeungkim.com/docs)** · **[한국어 문서](https://gantt.jaeungkim.com/ko/docs)**

## Motivation

I wanted Microsoft Project's Gantt chart for my own project planning, and it wanted a
subscription. So I built one, borrowing ideas from MS Project, DHTMLX and Frappe Gantt.

There are not many open-source Gantt charts, so I hope this is useful to someone else too.
Feedback, feature requests and pull requests are all welcome — this is my first open-source
project and I would like to keep improving it with whoever shows up.

## Install

```bash
pnpm add @jaeungkim/gantt-chart
```

`react` and `react-dom` (`^18` or `^19`) are peer dependencies.

## Usage

```tsx
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  {
    id: '1',
    name: 'Project kickoff',
    startDate: '2024-06-01T09:00:00Z',
    endDate: '2024-06-03T17:00:00Z',
    parentId: null,
    sequence: '1',
  },
  {
    id: '2',
    name: 'Requirements',
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
      height={600}
      theme="system"
      defaultScale="month"
      onTasksChange={(updated) => console.log(updated)}
    />
  );
}
```

The chart never stores your data. Every committed gesture ends in one `onTasksChange` call with a
new array, and it is up to you to keep it.

Full walkthrough: **[Quick start](https://gantt.jaeungkim.com/docs/quick-start)**.

## What it does

**Rendering** — virtualized rows, a configurable task list pane with a draggable splitter, six
timeline scales from hour to year, elbow-routed dependency arrows, date markers, range bands,
non-working-day shading and baseline bars.

**Editing** — move, resize and set progress by dragging; draw a new task on empty row space; draw
and delete dependency arrows; reorder, indent and outdent rows; undo and redo.

**Scheduling** — successors reschedule on a drag under a policy you choose, a working-day calendar
makes weekends and holidays stop counting, and the critical path comes with total and free slack.
The same functions are exported as plain functions you can call on a server or in a worker.

**Accessibility** — one ARIA treegrid with a roving tab stop; bars move, resize and step their
progress from the keyboard.

**Theming** — `--gantt-*` custom properties scoped to the chart container, a light / dark / system
theme prop, per-task colors, and four render props for replacing elements outright.

Each of these, and the honest list of what the library does **not** do, is in
**[Introduction](https://gantt.jaeungkim.com/docs/introduction)**.

## Documentation

| Page | |
|---|---|
| [Quick start](https://gantt.jaeungkim.com/docs/quick-start) | install to a working, editable chart |
| [Task data](https://gantt.jaeungkim.com/docs/task-data) | the `Task` shape and how the `tasks` prop is compared |
| [Editing tasks](https://gantt.jaeungkim.com/docs/editing) | gestures, permissions, touch |
| [Dependencies](https://gantt.jaeungkim.com/docs/dependencies) | the four link types and lag |
| [Scheduling](https://gantt.jaeungkim.com/docs/scheduling) | policies, working calendar, critical path, baselines |
| [Keyboard and screen readers](https://gantt.jaeungkim.com/docs/accessibility) | the key map, the ARIA tree, and the gaps |
| [Theming](https://gantt.jaeungkim.com/docs/theming) | the CSS custom properties |
| [Props](https://gantt.jaeungkim.com/docs/ref/props) | every prop, in one table |

All 35 pages: **[English](https://gantt.jaeungkim.com/docs)** · **[한국어](https://gantt.jaeungkim.com/ko/docs)**

## Contributing

Setup, the checks CI runs, and the branch and PR conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/jaeungkim/gantt-chart/discussions); issues are for bugs and
concrete feature requests.

## License

[MIT](LICENSE)
