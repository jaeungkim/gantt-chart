[![Banner](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/banner.png)](https://gantt.jaeungkim.com)

# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

React Gantt chart with editable bars, dependency arrows, and a headless scheduling core.

**[Quick start](https://gantt.jaeungkim.com/docs/quick-start)** · **[Documentation](https://gantt.jaeungkim.com/docs)** · **[한국어 문서](https://gantt.jaeungkim.com/ko/docs)**

`@jaeungkim/gantt-chart` ships a ready-to-use React component and the React-free scheduling
helpers behind it. Use `ReactGanttChart` when you want a production UI out of the box. Use the
exported core when you need dependency scheduling, working-day calendars, or critical-path
analysis in a server, worker, or test.

## Highlights

- Virtualized rows, task list columns, hierarchy, grouping, markers, baselines, dependency arrows,
  and PNG export.
- Move, resize, and set progress by drag; create and delete dependencies; reorder rows; undo and
  redo; veto a commit with `onBeforeTaskChange`.
- Headless exports for scheduling and analysis: `scheduleTasks`, `computeCriticalPath`,
  `createWorkingCalendar`, `buildTaskGraph`, and `buildTaskTree`.
- Keyboard-first ARIA treegrid, scoped `--gantt-*` theme tokens, light/dark/system theming,
  per-task colors, and four render props.

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
    type: 'milestone',
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

Full walkthrough: **[Quick start](https://gantt.jaeungkim.com/docs/quick-start)**.

## Why this package

A Gantt chart stops being a table the first time a bar moves. Snapping, dependency routing,
working-day math, critical path, and large row counts all have to agree on the same task model.

`@jaeungkim/gantt-chart` keeps that stack in one package: an opinionated React chart on top, and
the same scheduling primitives exported underneath. The design borrows from Microsoft Project,
DHTMLX, and Frappe Gantt, but leaves data fetching, persistence, validation, and app-specific
workflows to the host app.

The full boundary list is documented in
**[Introduction](https://gantt.jaeungkim.com/docs/introduction)**, including what the library
deliberately does not do.

## Documentation

| Page | What it covers |
|---|---|
| [Quick start](https://gantt.jaeungkim.com/docs/quick-start) | install to a working, editable chart |
| [Task data](https://gantt.jaeungkim.com/docs/task-data) | the `Task` shape, date handling, and how the `tasks` prop is compared |
| [Editing tasks](https://gantt.jaeungkim.com/docs/editing) | gestures, permissions, touch, and task creation |
| [Dependencies](https://gantt.jaeungkim.com/docs/dependencies) | the four link types, lag, and dependency drawing |
| [Scheduling](https://gantt.jaeungkim.com/docs/scheduling) | policies, the working calendar, critical path, and baselines |
| [Imperative API](https://gantt.jaeungkim.com/docs/imperative-api) | scrolling, zoom, undo/redo, and PNG export |
| [Headless core](https://gantt.jaeungkim.com/docs/headless-core) | using the scheduling engine without React or a DOM |
| [Theming](https://gantt.jaeungkim.com/docs/theming) | theme modes, CSS tokens, and render props |
| [Props](https://gantt.jaeungkim.com/docs/ref/props) | every prop, in one table |

Full docs: **[English](https://gantt.jaeungkim.com/docs)** · **[한국어](https://gantt.jaeungkim.com/ko/docs)**

## Contributing

Setup, the checks CI runs, and the branch and PR conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/jaeungkim/gantt-chart/discussions); issues are for bugs and
concrete feature requests.

## License

[MIT](LICENSE)
