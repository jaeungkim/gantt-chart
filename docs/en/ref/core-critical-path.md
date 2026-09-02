`computeCriticalPath` runs the critical path method over a `Task[]` and returns slack numbers,
early/late dates and the set of tasks and links that hold the project's finish where it is.
`forwardPass` and `backwardPass` are its two halves, exported so they can be run on their own.
All four, plus the `CriticalPathResult` and `TaskScheduleMetrics` types, come from the package root.

```ts
import {
  backwardPass,
  computeCriticalPath,
  forwardPass,
  type CriticalPathResult,
  type TaskScheduleMetrics,
} from '@jaeungkim/gantt-chart';
```

Behaviour and the `criticalPath` prop live in [Scheduling](../scheduling.md); running the core
without React is [Headless core](../headless-core.md).

## `computeCriticalPath`

```ts
/** Forward pass, backward pass, and the slack numbers that fall out of the two */
export function computeCriticalPath(
  tasks: Task[],
  options: CriticalPathOptions = {}
): CriticalPathResult
```

```ts
export interface CriticalPathOptions {
  calendar?: WorkingCalendar;
}
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `calendar` | `WorkingCalendar` | `CALENDAR_DAYS` | The day unit every number on this page is counted in. `CALENDAR_DAYS` counts every day; a calendar from `createWorkingCalendar` counts only working days. See [`core-calendar.md`](core-calendar.md) |

The graph is rebuilt with `buildTaskGraph(tasks)` on every call — there is no memoisation. A task's
`dependencies` array lists its predecessors; link shapes are in
[`core-scheduling.md`](core-scheduling.md).

An empty `tasks` array returns empty `metrics`, `criticalTaskIds` and `criticalLinkIds`,
`cycle: null` and `projectFinish: null`.

## `CriticalPathResult`

```ts
export interface CriticalPathResult {
  metrics: Map<string, TaskScheduleMetrics>;
  criticalTaskIds: Set<string>;
  /** Keys from `linkKey` for the links that lie along the critical path */
  criticalLinkIds: Set<string>;
  /** Ids caught in a dependency cycle - they get no metrics */
  cycle: string[] | null;
  /** The project's earliest finish (UTC ISO string), or null with no tasks */
  projectFinish: string | null;
}
```

| Field | Type | Contents |
|---|---|---|
| `metrics` | `Map<string, TaskScheduleMetrics>` | Keyed by task id. Only tasks the graph could topologically order get an entry |
| `criticalTaskIds` | `Set<string>` | Ids whose `critical` is `true` |
| `criticalLinkIds` | `Set<string>` | `linkKey` strings, shape `` `${predecessorId}>${successorId}:${type}` ``. A link is added only when both ends are in `criticalTaskIds` **and** its own float is exactly `0` |
| `cycle` | `string[] \| null` | `null` when the graph is acyclic. Otherwise every id that could not be ordered — this includes tasks merely downstream of the cycle, not only its members |
| `projectFinish` | `string \| null` | The latest early finish across every task, `Date.prototype.toISOString()` format (UTC). `null` only when `tasks` is empty |

## `TaskScheduleMetrics`

```ts
export interface TaskScheduleMetrics {
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  /** Days a task can slip before the project's finish moves */
  totalSlack: number;
  /** Days a task can slip before any successor's early start moves */
  freeSlack: number;
  critical: boolean;
  /** Calendar days, or working days when the working-day calendar is on */
  duration: number;
}
```

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `earlyStart` | `string` | UTC ISO string | The task's own `startDate` shifted forward by the earliest amount its predecessors allow |
| `earlyFinish` | `string` | UTC ISO string | The task's own end shifted by the same amount |
| `lateStart` | `string` | UTC ISO string | The task's own `startDate` shifted forward by the latest amount that still leaves `projectFinish` where it is |
| `lateFinish` | `string` | UTC ISO string | The task's own end shifted by the same amount |
| `totalSlack` | `number` | whole days | `lateShift - earlyShift` |
| `freeSlack` | `number` | whole days | Smallest float across the task's outgoing links, floored at `0`; equal to `totalSlack` when the task has no successors |
| `critical` | `boolean` | — | `totalSlack === 0` and the task's progress is not 100 |
| `duration` | `number` | whole days | `calendar.daysBetween(start, end)` |

The four date fields are produced by `.toISOString()`, so they are always UTC with a `Z` suffix and
millisecond precision. Every shift is a whole number of days, so a task's time of day survives both
passes unchanged.

### `totalSlack`

How many days the task can start later than `earlyStart` before `projectFinish` moves.
Computed as `lateDates.shift - earlyDates.shift` — both shifts being day counts relative to the
task's own stored dates.

- Unit: whole days, in the `calendar`'s day unit. With `CALENDAR_DAYS` a Friday-to-Monday gap is
  three days of slack; with a Monday–Friday working calendar it is one.
- `0` means the task is on the critical chain by date.
- No clamp is applied, so the value is whatever the subtraction produces.

### `freeSlack`

How many days the task can start later than `earlyStart` before it pushes the `earlyStart` of a
successor.

- For a task with at least one outgoing link:
  `Math.max(0, Math.min(...floats of its outgoing links))`. The floor at `0` means this field is
  never negative for such a task.
- For a task with **no** outgoing links it is set to `totalSlack`, not `0`. A leaf task's two slack
  numbers are therefore always equal.
- Unit: whole days, in the same `calendar` unit as `totalSlack`.
- Per-link float is
  `calendar.daysUpTo(predecessorAnchor, successorEarlyAnchor) - link.lag - predecessorEarlyShift`,
  so a link's `lag` is subtracted in the calendar's day unit too.

`freeSlack <= totalSlack` for any task with successors.

## `forwardPass`

```ts
/**
 * Earliest each task can run given its predecessors, walked predecessors-first.
 * A task with no predecessor stays on its own dates.
 */
export function forwardPass(
  tasks: Task[],
  calendar: WorkingCalendar = CALENDAR_DAYS,
  graph: TaskGraph = buildTaskGraph(tasks)
): Map<string, EarlyDates>
```

```ts
export interface EarlyDates {
  start: Dayjs;
  finish: Dayjs;
  /** Days later than the task's own dates */
  shift: number;
}
```

`shift` starts at `0` and only ever grows, so a task is never pulled earlier than its own
`startDate`. Tasks left out of `graph.order` are added to the returned map at their own dates with
`shift: 0`, so the map covers every id in `tasks`.

## `backwardPass`

```ts
/**
 * Latest each task can run without moving the project's finish, walked successors-first.
 *
 * Takes the forward pass's output rather than recomputing it, so it can be exercised on
 * its own with hand-written early dates.
 */
export function backwardPass(
  tasks: Task[],
  early: Map<string, EarlyDates>,
  calendar: WorkingCalendar = CALENDAR_DAYS,
  graph: TaskGraph = buildTaskGraph(tasks),
  projectFinish?: Dayjs
): Map<string, LateDates>
```

```ts
export interface LateDates {
  start: Dayjs;
  finish: Dayjs;
  /** Days later than the task's own dates the task could still run */
  shift: number;
}
```

| Parameter | Required | Default |
|---|---|---|
| `tasks` | yes | — |
| `early` | yes | — |
| `calendar` | no | `CALENDAR_DAYS` |
| `graph` | no | `buildTaskGraph(tasks)` — rebuilt unless the caller passes the same graph the forward pass used |
| `projectFinish` | no | The latest `finish` in `early` |

With no `projectFinish` argument and an empty `early` map, the function returns an empty map. Unlike
`forwardPass`, the returned map covers only the ids in `graph.order`.

## Not exported from the package root

These names appear above but are **not** in `src/index.tsx`, so they cannot be imported from
`@jaeungkim/gantt-chart`:

| Name | Kind | Workaround |
|---|---|---|
| `EarlyDates` | type | `type Early = ReturnType<typeof forwardPass>` gives `Map<string, EarlyDates>` |
| `LateDates` | type | `type Late = ReturnType<typeof backwardPass>` |
| `CriticalPathOptions` | type | Pass the object literal inline; `calendar` is its only member |
| `normalizeProgress` | function | `typeof p === 'number' && !Number.isNaN(p) ? Math.min(100, Math.max(0, p)) : null` — the real one returns `null`, not a number, for a missing or `NaN` progress |
| `taskStart`, `taskEnd`, `linkSourceDate`, `linkTargetDate` | functions | Internal; no public equivalent |

`buildTaskGraph`, `linkKey` and `TaskGraph` are exported — see [`core-graph.md`](core-graph.md).
`CALENDAR_DAYS`, `createWorkingCalendar` and `WorkingCalendar` are exported too — see
[`core-calendar.md`](core-calendar.md).

## Notes

A task whose progress is 100 is never marked `critical`. `critical` is
`totalSlack === 0 && normalizeProgress(task.progress) !== 100`, and `normalizeProgress` clamps to
the `0`–`100` range first, so `progress: 150` counts as 100 and drops the task off the critical
path. A non-numeric or `NaN` progress is not treated as finished.

The 100%-progress rule changes the flags only. `totalSlack` and `freeSlack` for a finished task keep
the values the two passes produced, so `critical: false` does not imply `totalSlack > 0`. Because a
critical link needs both ends in `criticalTaskIds`, marking a task finished also removes every link
touching it from `criticalLinkIds`.

Tasks caught in a dependency cycle, and tasks downstream of one, get no entry in `metrics` — the
metrics loop walks `graph.order`, which excludes them. Their ids appear in `cycle`.

`duration` is day-granular. `calendar.daysBetween` takes `startOf('day')` on both ends, so a task
running `09:00` to `17:00` on one date reports `0`. A milestone reports `0` because its end is its
`startDate`.

`projectFinish` reduces over every entry in the forward pass's map, which includes tasks left out of
`graph.order`. A task caught in a cycle can therefore set the project finish even though it has no
metrics.

`linkKey` does not include `lag`. Two dependencies between the same pair with the same `type` share
one key, so they share one float value and one `criticalLinkIds` entry.

`computeCriticalPath` never moves a task. It reads `tasks` and returns numbers; propagation is
`scheduleTasks` ([`core-scheduling.md`](core-scheduling.md)).
