These are the payloads the chart hands to a callback before it writes anything, plus the draft it hands over for a task it will never create itself. All six are exported from the package root as types.

```ts
import type {
  GanttBeforeChangeHandler,
  GanttChangeType,
  GanttDependencyChange,
  GanttReorderChange,
  GanttTaskChange,
  GanttTaskDraft,
} from '@jaeungkim/gantt-chart';
```

Which callback carries which payload:

| Callback | Payload | Return value |
|---|---|---|
| `onBeforeTaskChange` | `GanttTaskChange` | `boolean \| void \| Promise<boolean \| void>` |
| `onReorder` | `GanttReorderChange` | `void \| boolean` |
| `onDependencyCreate` | `GanttDependencyChange` | `boolean \| void` |
| `onDependencyDelete` | `GanttDependencyChange` | `boolean \| void` |
| `onTaskCreate` | `GanttTaskDraft` | `void` |

Every prop signature is listed in [GanttProps](props.md). The behaviour behind the veto is in [Events and cancellable changes](../events.md).

## GanttChangeType

```ts
/** What a gesture is about to write */
export type GanttChangeType = 'move' | 'resize' | 'progress';
```

| Value | Gesture |
|---|---|
| `'move'` | The whole bar was dragged. Both `startDate` and `endDate` are rewritten. |
| `'resize'` | One edge was dragged. `edge` says which, and only that date is rewritten. |
| `'progress'` | The progress handle was dragged. Only `progress` is rewritten. |

## GanttTaskChange

```ts
/**
 * The mutation a finished gesture wants to commit
 *
 * Handed to `onBeforeTaskChange` before anything is written, so a host can send it to a
 * server and answer with a veto.
 */
export interface GanttTaskChange {
  type: GanttChangeType;
  /** The bar the user grabbed */
  task: Task;
  /** Only the tasks this gesture rewrites - dragging a summary bar carries its whole subtree */
  changedTasks: Task[];
  /** Those same tasks as they were before the gesture, in the same order */
  previousTasks: Task[];
  /** The full array the chart would hand to `onTasksChange` */
  tasks: Task[];
  /** Which edge moved - `resize` only */
  edge?: 'start' | 'end';
}
```

| Field | Type | Meaning |
|---|---|---|
| `type` | `GanttChangeType` | `'move'` for a bar drag, `'resize'` for an edge drag, `'progress'` for the progress handle. |
| `task` | `Task` | The task whose bar the gesture started on, in its post-gesture state. |
| `changedTasks` | `Task[]` | Post-gesture state of every task this gesture rewrites, in render order. |
| `previousTasks` | `Task[]` | The same tasks as they were before, index for index with `changedTasks`. |
| `tasks` | `Task[]` | The complete array `onTasksChange` receives if the change commits. |
| `edge` | `'start' \| 'end'` | `'start'` for a left-edge resize, `'end'` for a right-edge resize, `undefined` for `'move'` and `'progress'`. |

`Task` is defined in [Task and task types](task.md).

`changedTasks` holds more than one entry in two cases: a summary bar was dragged, so its whole subtree moved; or auto-scheduling is on and the drop pushed successors. Both are described in [Editing tasks](../editing.md) and [Scheduling](../scheduling.md).

## GanttBeforeChangeHandler

```ts
/**
 * Runs before a gesture is committed and can cancel it
 *
 * Returning `false`, a promise resolving to `false`, or a rejected promise rolls the bar
 * back to where it started. Anything else commits. While the promise is pending the bar
 * stays where it was dropped, so the UI never blocks on the round trip.
 */
export type GanttBeforeChangeHandler = (
  change: GanttTaskChange
) => boolean | void | Promise<boolean | void>;
```

## GanttReorderChange

```ts
/**
 * What a row drag committed - everything needed to persist the move
 *
 * Returning `false` from the callback cancels the drop: nothing is written to the chart and
 * `onTasksChange` does not fire.
 */
export interface GanttReorderChange {
  /** The moved task, already carrying its new parentId and sequence */
  task: Task;
  /** The new parent (null = root) */
  parentId: string | null;
  /** The parent the task had in the incoming data, untouched by normalization */
  previousParentId: string | null;
  /** Zero-based position among the new parent's children */
  index: number;
  /** The moved task's new dotted sequence */
  sequence: string;
  /** The whole updated array - the same one onTasksChange receives */
  tasks: Task[];
}
```

| Field | Type | Meaning |
|---|---|---|
| `task` | `Task` | The dragged task, already carrying the new `parentId` and `sequence`. |
| `parentId` | `string \| null` | The parent it was dropped under. `null` is the root level. |
| `previousParentId` | `string \| null` | The `parentId` the task had in the array passed in, before the chart normalized anything. |
| `index` | `number` | Zero-based position among the new parent's children. |
| `sequence` | `string` | The task's new dotted sequence, the same value as `task.sequence`. |
| `tasks` | `Task[]` | The complete renumbered array `onTasksChange` receives if the drop commits. |

The renumbering rules are in [Reordering rows](../reordering.md).

## GanttDependencyChange

```ts
/** The link the user drew, handed to `onDependencyCreate` before anything is committed */
export interface GanttDependencyChange {
  /** Task the drag started on */
  predecessorId: string;
  /** Task the drag was dropped on - the one whose `dependencies` gains the entry */
  successorId: string;
  type: DependencyType;
}
```

| Field | Type | Meaning |
|---|---|---|
| `predecessorId` | `string` | The earlier task in the link. On a delete, the `targetId` of the entry being removed. |
| `successorId` | `string` | The later task, the one whose `dependencies` array gains or loses the entry. |
| `type` | `DependencyType` | `'FS'`, `'SS'`, `'FF'` or `'SF'`, derived from the two connector dots the drag ran between. |

`DependencyType` is defined in [Task and task types](task.md). The four link types are explained in [Dependencies](../dependencies.md).

## GanttTaskDraft

```ts
/** The task the user drew, handed to `onTaskCreate` - nothing is committed by the chart */
export interface GanttTaskDraft {
  /** UTC ISO string, snapped to the current scale */
  startDate: string;
  endDate: string;
  /** Id of the task whose row the range was drawn on, null when the row has none */
  rowTaskId: string | null;
}
```

| Field | Type | Meaning |
|---|---|---|
| `startDate` | `string` | UTC ISO string. The start of the first tick the drag touched, at the current scale. |
| `endDate` | `string` | UTC ISO string. The end of the last tick the drag touched, so the range always covers whole ticks. |
| `rowTaskId` | `string \| null` | The task owning the row the range was drawn on. `null` for a group header row, and for a drag below the last row. A lane row holding several tasks yields the first task's id. |

Drawing is described in [Editing tasks](../editing.md).

## Constraints

The four cancellable callbacks do not read their return values the same way.

| Callback | Veto test | Promise awaited | On throw |
|---|---|---|---|
| `onBeforeTaskChange` | resolved value `=== false` | yes | rolls back |
| `onReorder` | returned value `=== false` | no | propagates to the pointer handler |
| `onDependencyCreate` | returned value `=== false` | no | propagates to the pointer handler |
| `onDependencyDelete` | returned value `=== false` | no | propagates to the pointer handler |
| `onTaskCreate` | not cancellable | no | propagates to the pointer handler |

`onBeforeTaskChange` is the only awaited one. The chart awaits whatever the handler returns and vetoes only on a strict `=== false`; `undefined`, `null`, `0` and `''` all commit. A thrown error or a rejected promise is treated as a failure and rolls the bar back. While the promise is pending the bar stays where the user dropped it and nothing is written.

`onReorder`, `onDependencyCreate` and `onDependencyDelete` are compared against `false` synchronously. A returned promise is an object, so it is never `false` and the change commits immediately — whatever the promise later resolves to is ignored.

`onTaskCreate` returns `void` and its return value is discarded. The chart adds no task of its own: the row appears only when the host passes a new `tasks` array back in.

A second gesture in the same lane while a `onBeforeTaskChange` promise is still pending drops the late answer instead of applying it. Moves and resizes share one lane per task, so they supersede each other; a progress edit has its own lane and leaves a pending date change alone.

`onBeforeTaskChange` fires for pointer gestures only. Keyboard nudges and keyboard progress steps commit straight to the chart and call `onTasksChange` without passing through it.

`GanttDependencyChange` carries no `lag`. Both the create and the delete callback describe the link by its two ends and its type only.

Next: [GanttHandle](handle.md).
