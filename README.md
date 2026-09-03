[![Banner](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/banner.png)](https://gantt.jaeungkim.com)

# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

React Gantt chart with editable bars, dependency arrows, and a headless date core.

**[Quick start](https://gantt.jaeungkim.com/docs/quick-start)** · **[Documentation](https://gantt.jaeungkim.com/docs)** · **[한국어 문서](https://gantt.jaeungkim.com/ko/docs)**

`@jaeungkim/gantt-chart` ships a ready-to-use React component and the React-free helpers behind
it. Use `ReactGanttChart` when you want a production UI out of the box. Use the exported core when
you need working-day calendars or task-tree roll-up in a server, worker, or test.

## Highlights

- Virtualized rows, hierarchy, lane packing, dependency arrows, and a
  today line.
- Move, resize, and set progress by drag; create and delete dependencies; add a task from the
  button under the task list, from `addTask()` on the ref, or by drawing on empty row space.
- Docked detail panel: narrows the timeline instead of covering it, `renderDetail` owns the body.
- Headless exports: `createWorkingCalendar`, `buildTaskTree`, `rollUpTasks`, and
  `collectSubtreeIds`.
- Keyboard-first ARIA treegrid, scoped `--gantt-*` theme tokens, light/dark/system theming,
  per-task colors that also decide whether the bar label is black or white, and one render prop,
  `renderDetail`.
- Renders the chart, not the chrome. The scale control is yours — drive it with `setScale` on
  the ref and follow it with `onScaleChange`, so the labels are in your language and your
  design system.

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

The chart does not keep your canonical data. A committed gesture ends in one `onTasksChange` call
with the complete next task array, so your app stays the source of truth.

It ships no toolbar either, so the scale control is a control you own:

```tsx
const chart = useRef<GanttHandle>(null);
const [scale, setScale] = useState<GanttScaleKey>('month');

<ReactGanttChart ref={chart} tasks={tasks} defaultScale="month" onScaleChange={setScale} />

<select value={scale} onChange={(e) => chart.current?.setScale(e.target.value as GanttScaleKey)}>
  {['day', 'week', 'month', 'quarter', 'year'].map((s) => (
    <option key={s} value={s}>{s}</option>
  ))}
</select>
```

`onScaleChange` fires for every source, so the select stays in step when Ctrl/Cmd + wheel or
Ctrl/Cmd + arrow moves the scale instead.

Full walkthrough: **[Quick start](https://gantt.jaeungkim.com/docs/quick-start)**.

## Why this package

A Gantt chart stops being a table the first time a bar moves. Snapping, dependency routing,
working-day math, and large row counts all have to agree on the same task model.

`@jaeungkim/gantt-chart` keeps that stack in one package: an opinionated React chart on top, and
the same date primitives exported underneath. It leaves data fetching, persistence, validation,
auto-scheduling, and app-specific workflows to the host app.

The full boundary list is documented in
**[Introduction](https://gantt.jaeungkim.com/docs/introduction)**, including what the library
deliberately does not do.

## Documentation

| Page | What it covers |
|---|---|
| [Quick start](https://gantt.jaeungkim.com/docs/quick-start) | install to a working, editable chart |
| [Task data](https://gantt.jaeungkim.com/docs/task-data) | the `Task` shape, date handling, and how the `tasks` prop is compared |
| [Editing tasks](https://gantt.jaeungkim.com/docs/editing) | gestures, permissions, touch, and task creation |
| [Dependencies](https://gantt.jaeungkim.com/docs/dependencies) | the four link types and dependency drawing |
| [Working calendar](https://gantt.jaeungkim.com/docs/working-calendar) | non-working days and working-day arithmetic |
| [Imperative API](https://gantt.jaeungkim.com/docs/imperative-api) | scrolling and zoom through the chart ref |
| [Headless core](https://gantt.jaeungkim.com/docs/headless-core) | using the calendar and tree helpers without React or a DOM |
| [Styling](https://gantt.jaeungkim.com/docs/styling) | per-task color and class names |
| [Theming](https://gantt.jaeungkim.com/docs/theming) | theme modes and the CSS custom properties |
| [Props](https://gantt.jaeungkim.com/docs/ref/props) | every prop, in one table |

Full docs: **[English](https://gantt.jaeungkim.com/docs)** · **[한국어](https://gantt.jaeungkim.com/ko/docs)**

## Contributing

Setup, the checks CI runs, and the branch and PR conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/jaeungkim/gantt-chart/discussions); issues are for bugs and
concrete feature requests.

## License

[MIT](LICENSE)
