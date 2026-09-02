You read `row` on one page and `task` on the next, and you assume they are the same thing. They
are not, and the difference bites the first time two tasks share a row. This page fixes one word per
thing. Every other page uses these words and only these words.

## The chart and the host app

**The chart** is the `<ReactGanttChart>` component exported by `@jaeungkim/gantt-chart`. It draws
what the `tasks` prop gives it and reports every edit back.

**The host app** is your application around it. It owns the task array, decides what to persist,
and applies whatever the chart hands to `onTasksChange` — see
[Events and cancellable changes](events.md).

## What is on screen

```text
        task list                                  timeline
┌──────────────────────────┬───────────────────────────────────────────────┐
│                          │  March 2026                  │  April 2026    │  top header row
│                          │  2    9    16   23   30      │  6    13       │  ticks (one per day; thinned to fit)
├──────────────────────────┼───────────────────────────────────────────────┤
│ ▾ Phase 1                │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │  summary row
│     Design         +1    │  ████──▶ ███████████████                      │  lane row: two tasks
│                          │          ▁▁▁▁▁▁▁▁▁▁▁▁▁                        │  baseline, same row
│   Ship                   │                          ◆                    │  milestone
└──────────────────────────┴───────────────────────────────────────────────┘
```

| Word | What it names |
|---|---|
| task | One item of data — one entry in the `tasks` array. |
| bar | The horizontal block drawn for one task. Dragging it is [Editing tasks](editing.md). |
| row | One line of the grid. It can carry zero, one or several tasks. |
| task list | The left pane, the grid of columns beside the timeline. See [Task list and hierarchy](task-list.md). |
| timeline | The time axis and everything drawn against it. See [The timeline](timeline.md). |
| scale | Which unit the timeline is drawn in: `hour`, `day`, `week`, `month`, `quarter` or `year`. See [The timeline](timeline.md). |
| tick | One cell of the lower header row. How much time one tick covers depends on the scale. |
| summary row | A task that has children under `parentId`, with `hierarchy` on. Its dates come from the children. See [Task list and hierarchy](task-list.md). |
| milestone | A task with `type: 'milestone'`, drawn as a diamond at `startDate`. See [Task data](task-data.md). |
| group header row | The band label produced by a `groupBy` value that at least one task carries. It owns no task of its own. See [Grouping and swimlanes](grouping.md). |
| swimlane | The band of rows under one group header row. See [Grouping and swimlanes](grouping.md). |
| lane | The `lane` field, which puts several tasks side by side on one row. See [Grouping and swimlanes](grouping.md). |

Every word above names something in this snippet:

```tsx
// concepts-demo.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initialTasks: Task[] = [
  {
    id: 'phase-1',
    name: 'Phase 1',
    startDate: '2026-03-02',
    endDate: '2026-03-20',
    parentId: null,
    sequence: '1',
  },
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02',
    endDate: '2026-03-06',
    parentId: 'phase-1',
    sequence: '1.1',
    lane: 'Ana',
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2026-03-09',
    endDate: '2026-03-20',
    parentId: 'phase-1',
    sequence: '1.2',
    lane: 'Ana',
    progress: 40,
    dependencies: [{ targetId: 'design', type: 'FS', lag: 1 }],
    baselineStart: '2026-03-09',
    baselineEnd: '2026-03-18',
  },
  {
    id: 'ship',
    name: 'Ship',
    type: 'milestone',
    startDate: '2026-03-23',
    endDate: '2026-03-23',
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: 'build', type: 'FS' }],
  },
];

export function Demo() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      hierarchy
      workingCalendar
      criticalPath
    />
  );
}
```

Four tasks, three rows: `design` and `build` share the lane `Ana` and do not overlap, so they are
packed onto one row. [Grouping and swimlanes](grouping.md) owns that packing.

## The words for your data

**Task.** The unit you pass in. Six fields are required — `id`, `name`, `startDate`, `endDate`,
`parentId`, `sequence` — and the rest are optional. The field table lives in
[Task data](task-data.md), the type in [`Task`](ref/task.md).

**Milestone.** A task whose `type` is exactly the string `'milestone'`. It renders as a diamond at
`startDate`, and its `endDate` is ignored in rendering, roll-up, lane packing and scheduling. It is
still read when the timeline works out its own date range, so a stray `endDate` on a milestone
stretches the chart with nothing drawn out there. [Task data](task-data.md) lists every place the
field still counts.

**Dependency.** A link between two tasks, in one of four types: `FS`, `SS`, `FF`, `SF`. The first
letter is the predecessor's end, the second is the successor's end. See
[Dependencies](dependencies.md).

**Predecessor and successor.** The predecessor is the earlier task in a link, the successor the
later one. The entry lives on the **successor**, and its `targetId` names the predecessor:

```ts
import type { TaskDependency } from '@jaeungkim/gantt-chart';

// This sits on "build", the successor. It reads: build waits for design to finish.
const dependencies: TaskDependency[] = [{ targetId: 'design', type: 'FS' }];
```

**Lag.** A signed offset on a link, in whole days — working days when `workingCalendar` is on,
calendar days otherwise. Positive waits that long after the predecessor, negative overlaps the two —
a lead is a negative lag, not a separate field.

**Baseline.** A planned snapshot, `baselineStart` and `baselineEnd`, drawn as a thin bar under the
live one. It moves only when the data changes. Dragging the live bar slides it across a baseline
that stays put. See [Scheduling](scheduling.md).

## The words for the schedule

**Working calendar.** The rule that decides which days count. With `workingCalendar` off, every
calendar day counts. With it on, weekends and `holidays` are skipped when durations, lag, slack and
propagation are counted, and a dropped bar snaps onto the next working day. Bars still span the
weekend on screen — the days only stop counting. [Scheduling](scheduling.md) says exactly what it
does and does not change.

**Scheduling policy.** What happens to everything downstream when you drag or resize a bar.
`schedulingPolicy` picks between leaving successors alone, pushing broken links later, or holding
every gap exactly — see [Scheduling](scheduling.md).

**Slack.** How far a task can slip. **Total slack** is the slip it can take before the project's
finish moves. **Free slack** is the slip it can take before any successor's earliest start moves.
Both are computed only with `criticalPath` on.

**Critical path.** The chain of tasks with no total slack, whose delay moves the project's finish.
A task at 100% progress is never on it — [Scheduling](scheduling.md) has the rule and the
consequences for the arrows.

## Sequence orders, parentId nests

They are two independent fields and nothing reconciles them.

`sequence` decides **row order**, always, hierarchy or not. It is a dotted string compared segment
by segment as numbers — [Task data](task-data.md) owns the comparison rules.

`parentId` decides **nesting**, and only when the `hierarchy` prop is on. With it off, indentation is
read from the number of dots in `sequence` instead. `parentId` is not inert, though: deleting a task
still takes its whole subtree with it, hierarchy on or off — see
[Keyboard and screen readers](accessibility.md).

Three tasks, where `Audit` is a child of `Phase 1` but carries a top-level `sequence`:

```text
task      sequence   parentId      hierarchy off      hierarchy on
Phase 1   '1'        null          Phase 1            Phase 1
Design    '1.1'      'phase-1'       Design             Design
Audit     '3'        'phase-1'     Audit                Audit
```

Row order is the same in both columns, because both read `sequence`. Only the indentation moves.

The two agreeing is a convention, not a rule. A child whose `sequence` sorts above its parent
renders above its parent, indented, with no warning. The chart only rewrites `sequence` for you on a
row reorder — see [Reordering rows](reordering.md).

## A row is not a task

`GanttRow.tasks` is an array, and its length is 0, 1 or more:

| Row | `tasks.length` | When |
|---|---|---|
| ordinary row | 1 | the normal case |
| lane row | 2 or more | tasks in the same group sharing a `lane`, that do not overlap in time |
| group header row | 0 | one per `groupBy` value |

So "the third row" and "the third task" are different statements as soon as `lane` or `groupBy` is
in play. Code reading `row.tasks[0]` is reading the first task on that row, not the row itself. The
row model, its ids and its ARIA numbering are owned by [Grouping and swimlanes](grouping.md) and
[`GanttRow`](ref/grouping.md).

> [!NOTE]
> The `lane` field's own doc comment in the source calls it a swimlane. These docs keep the two
> words apart. A swimlane is a band of rows produced by `groupBy`. A lane is several tasks packed
> onto one row. The two are independent mechanisms that compose.

## Which words need a prop turned on

Half of the vocabulary above describes nothing until you switch something on.

| Concept | Needs | Default |
|---|---|---|
| summary row, roll-up, subtree drag, collapsing a task row | `hierarchy` | `false` |
| group header row, swimlane | `groupBy` | none set |
| lane row | a `lane` value on two or more tasks | no prop |
| slack, critical path, `duration` | `criticalPath` | `false` |
| working days counted instead of calendar days | `workingCalendar` | `false` |
| a dragged bar moving its successors | `schedulingPolicy` | `'off'` |
| `lag` having any effect | `schedulingPolicy` or `criticalPath` | both off |
| baseline bar | nothing — a `baselineStart` on the task is enough | always on |

Two of those catch people out. `lag` is inert on a chart with neither `schedulingPolicy` nor
`criticalPath` on: a `lag: 5` link draws exactly like a `lag: 0` one. Baselines are the opposite —
there is no prop to turn them off, so any task carrying `baselineStart` draws one.

## Limits

The vocabulary is wider than the behaviour behind it. These are the gaps, and the work that stays
with the host app.

- **No word here implies validation.** There is no schema and no runtime type check on `Task`: no
  id-uniqueness check, no date parsing check, no progress range check on input. Bad data degrades
  silently, and a missing `sequence` throws during render. Two tasks sharing an `id` both draw a row,
  but every lookup keyed by id — the tree, the dependency graph, the roll-up — keeps only the last of
  them. [Task data](task-data.md) lists what each malformed field does.
- **The chart owns no data.** It renders the `tasks` prop and hands every edit to `onTasksChange`.
  Persistence, optimistic updates and server round-trips are the host app's, and drawing a new task
  only proposes a draft — the host produces the `id`, `parentId` and `sequence`. See
  [Editing tasks](editing.md).
- **There is no resource, cost or effort model.** A task has no assignee, owner or budget field.
  You can hang your own properties on a task object and group by them, but they are untyped and they
  count toward the `tasks` diff — [Task data](task-data.md) explains that diff.
- **One calendar per chart.** There is no per-task working calendar and no per-task time zone. All
  dates are UTC.
- **A baseline is a drawn snapshot, not a comparison.** Nothing computes variance between the
  baseline and the live dates. The host does that arithmetic if it wants a number.
- **Rows are not a layout API.** You cannot set a row's height, force a group to exist with no
  tasks in it, or nest one group inside another.
- **A row that is not exactly one task turns row reordering off.** One `groupBy` header, or one lane
  row carrying two tasks, disables dragging on every row of the chart, silently. See
  [Reordering rows](reordering.md).

Next: [Quick start](quick-start.md) puts these words on screen.
