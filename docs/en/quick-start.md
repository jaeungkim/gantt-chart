You have an array of rows, each with a start date, an end date and a parent id. Turning that into
bars a user can drag is the part every app rewrites by hand. The sections below go from `pnpm add`
to a chart whose edits land in your own state. The first three code blocks are whole files; the
later ones are diffs against them.

## Install

The package ships as ESM and CJS, with React as a peer dependency. React 18 and React 19 are both
supported.

```bash
pnpm add @jaeungkim/gantt-chart
# npm install @jaeungkim/gantt-chart
# yarn add @jaeungkim/gantt-chart
```

Then import the stylesheet once, anywhere in your app:

```ts
// src/main.tsx
import '@jaeungkim/gantt-chart/style.css';
```

That specifier is a declared subpath export in `package.json` — `"./style.css"` maps to
`./dist/gantt-chart.css` — so it resolves without a deep path into `dist`. Skip the import and
nothing lays itself out. `.gantt-container` never gets its flex column, the bars keep the inline
`translateX` the component writes but not the `position: absolute` the stylesheet gives them, and
every `--gantt-*` token is undefined. The result reads as a stack of plain text rather than a
broken chart, so the missing import is easy to misread as a data problem.

## Render three tasks

Six fields are required on every task: `id`, `name`, `startDate`, `endDate`, `parentId` and
`sequence`. `sequence` is a dot-separated string and it decides row order. A bare `YYYY-MM-DD`
date is read as UTC midnight, so it lands on the day it names in every viewer's time zone. The
[Task data](task-data.md) page owns those rules in full.

```ts
// src/tasks.ts
import type { Task } from '@jaeungkim/gantt-chart';

export const initialTasks: Task[] = [
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
```

`dependencies` lists what a task waits on, so `build` carries the link back to `design`. `FS` is
finish-to-start; the other three types are in [Dependencies](dependencies.md).

```tsx
// src/ProjectChart.tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import { initialTasks } from './tasks';

export function ProjectChart() {
  return <ReactGanttChart tasks={initialTasks} height={420} />;
}
```

`height` defaults to `600` and `width` to `"100%"`. Both take a number of pixels or any CSS length
string. A percentage height only resolves if the parent element has a height of its own.

That chart is already editable with no further props. A bar can be dragged sideways to move the
task, and grabbed at either edge to resize it. `design` and `build` show a progress handle because
they carry a numeric `progress`; `ship` is a milestone diamond and never shows one. Hovering a bar
reveals a connector dot at each end; dragging from one onto another bar draws a dependency arrow.
Clicking an arrow selects it, and Delete or Backspace removes it. The toolbar's segmented control
switches between the six scales, `hour` to `year`. Ctrl/Cmd+Z undoes the last gesture and
Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) redoes it, while the focus is inside the chart.

None of it survives a reload. The chart keeps the edits in a store of its own, and that store is
created per instance and lives only as long as the component. The one thing that does persist is
the scale: the user's choice is written to `sessionStorage` under the key `gantt-scale`, which the
`storageKey` prop renames, so it comes back on remount within the same tab session.

## Keep the edits

`onTasksChange` fires with the complete new task array after every committed gesture. Store it and
the chart becomes the editor for data you own.

```tsx
// src/ProjectChart.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import { initialTasks } from './tasks';

export function ProjectChart() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleTasksChange = (next: Task[]) => {
    setTasks(next);
    void fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  };

  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={handleTasksChange}
      height={420}
    />
  );
}
```

The callback hands back every task, not a patch, so the array can go straight into state or straight
into a request body. Dates come back as full ISO strings such as `2026-03-09T00:00:00.000Z`, which
means the first drag changes the string form of a date you originally wrote as `2026-03-09`.

> [!WARNING]
> The `tasks` prop is compared by content, not by array identity, so handing the same data back
> under a new array is deliberately ignored — see [Task data](task-data.md) for what that protects
> and when a genuine replacement does win.

## Add the task list

The left pane is off until you ask for it. Passing `columns` turns it on by itself; passing
`showTaskList` on its own turns it on with the built-in Name / Start / End columns.

```diff
  // src/ProjectChart.tsx
- import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
+ import {
+   ReactGanttChart,
+   type GanttColumn,
+   type Task,
+ } from '@jaeungkim/gantt-chart';
+
+ const columns: GanttColumn[] = [
+   { key: 'name', header: 'Task', width: 200 },
+   { key: 'startDate', header: 'Start', width: 110 },
+   { key: 'progress', header: '%', width: 60, render: (task) => task.progress ?? '' },
+ ];
```

```diff
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={handleTasksChange}
        height={420}
+       columns={columns}
      />
```

A column without a `render` prints `task[key]` as a string, and `width` defaults to 120 pixels. The
splitter between the two panes, the collapse button and the tree column are covered in
[Task list and hierarchy](task-list.md).

## Make it a tree

Row order always comes from `sequence`. Nesting is a separate opt-in: set `hierarchy` and depth is
read from the `parentId` chain instead.

```diff
  // src/tasks.ts
+ {
+   id: 'phase-1',
+   name: 'Phase 1',
+   startDate: '2026-03-02',
+   endDate: '2026-03-20',
+   parentId: null,
+   sequence: '1',
+ },
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02',
    endDate: '2026-03-06',
-   parentId: null,
-   sequence: '1',
+   parentId: 'phase-1',
+   sequence: '1.1',
    progress: 100,
  },
```

Give `build` the same treatment: `parentId: 'phase-1'` and `sequence: '1.2'`. Leave every other
field on both tasks alone.

```diff
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={handleTasksChange}
        height={420}
        columns={columns}
+       hierarchy
      />
```

`phase-1` now has children, which makes it a summary row: its dates are recomputed from the
children rather than read from its own fields, and dragging its bar moves the whole subtree.
[Task list and hierarchy](task-list.md) explains the roll-up and the collapse state.

## Limits

- The chart stores nothing. Without `onTasksChange` an edit exists only in the component's own
  store, and a reload discards it. Fetching, saving and conflict resolution are the host app's job.
- The chart never adds a task on its own. Drawing a range on empty row space exists only when you
  pass `onTaskCreate`, and it reports a draft rather than committing one; see
  [Editing tasks](editing.md).
- It does remove one. Delete or Backspace on a focused row deletes that task and its whole subtree
  and fires `onTasksChange`; the same key press also removes a selected dependency arrow, so both
  can happen at once. A change in row count cannot be recorded as an undo step, so it clears the
  history instead.
- There is no validation of task data. A `sequence` of `undefined` throws during render, and an
  unparseable date produces a bar spanning the whole timeline with no warning. Validate before
  passing the array in.
- No fonts are bundled or fetched: `--gantt-font-sans` is a system stack, and the host overrides it
  like any other token; see [Theming](theming.md). The only reset is `box-sizing: border-box`, and
  it is scoped to `.gantt-container` rather than exported globally.
- The React component always renders its own toolbar and timeline. There is no unstyled mode of it.
  The scheduling, graph and calendar functions are separately importable without React, which is
  what [Headless core](headless-core.md) is for.

## Where to next

- The data does not look the way you expected: [Task data](task-data.md).
- You need columns, indentation or collapsing: [Task list and hierarchy](task-list.md).
- You need to lock down what can be dragged, or veto a change: [Editing tasks](editing.md).
- You want successors to move when a predecessor does: [Scheduling](scheduling.md).
- You want every prop in one table: [Props](ref/props.md).

Next: [Task data](task-data.md), which owns the field-by-field contract this page only sketched.
