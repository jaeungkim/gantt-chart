[![Banner](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/banner.png)](https://gantt.jaeungkim.com)

# @jaeungkim/gantt-chart

[![npm version](https://img.shields.io/npm/v/@jaeungkim/gantt-chart)](https://www.npmjs.com/package/@jaeungkim/gantt-chart)
[![CI](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml/badge.svg)](https://github.com/jaeungkim/gantt-chart/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@jaeungkim/gantt-chart)](LICENSE)

An editable Gantt chart for React.

[Quick start](https://gantt.jaeungkim.com/docs/quick-start) |
[Playground](https://gantt.jaeungkim.com/playground) |
[Documentation](https://gantt.jaeungkim.com/docs) |
[한국어 문서](https://gantt.jaeungkim.com/ko/docs)

## Features

- Bar drags that move a task, resize it from either edge and set its progress.
- Dependency arrows for `FS`, `SS`, `FF` and `SF`, drawn between bars and removed with Delete or Backspace.
- A task list pane with the `parentId` tree, summary roll-up and row reordering.
- A docked detail panel that narrows the timeline and edits the task in place.
- Five scales from `day` to `year`, rows and time cells virtualized together, and tasks packed onto shared rows by `lane`.
- A working calendar from `workingWeekdays` and `holidays`, which also shades the timeline.
- Keyboard editing and screen reader announcements on one ARIA treegrid.
- `locale` date labels through `Intl.DateTimeFormat`, and a light, dark or system theme.

## Install

```bash
pnpm add @jaeungkim/gantt-chart
# npm install @jaeungkim/gantt-chart
# yarn add @jaeungkim/gantt-chart
```

`react` and `react-dom` (`^18` or `^19`) are peer dependencies. The runtime dependencies are
`dayjs` and `zustand`.

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

That chart is editable. Every committed gesture ends in one `onTasksChange` call with the complete
next array. The chart persists nothing, including the scale.

## Documentation

[Quick start](https://gantt.jaeungkim.com/docs/quick-start) goes from install to a chart your app
can edit. [GanttProps](https://gantt.jaeungkim.com/docs/ref/props) lists every prop, callback and
default. The chart renders no toolbar, so your app renders the scale control and drives it
through the `ref` in [Imperative API](https://gantt.jaeungkim.com/docs/imperative-api).

The tree and calendar helpers are exported as plain functions that run without React or a DOM. See
[Headless core](https://gantt.jaeungkim.com/docs/headless-core).

Release notes are on [GitHub Releases](https://github.com/jaeungkim/gantt-chart/releases).

## Contributing

Setup, the checks CI runs, and the branch and PR conventions are in
[CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/jaeungkim/gantt-chart/discussions). Issues are for bugs and
concrete feature requests.

## License

[MIT](LICENSE)
