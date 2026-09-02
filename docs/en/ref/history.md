`GanttHistoryApi` is the undo/redo half of the ref handle: two methods and two flags for building an
Undo/Redo toolbar. It is one of the three interfaces [`GanttHandle`](handle.md) extends, so every
member listed here is reachable on `ref.current`. Import the type from the package root; see
[Imperative API](../imperative-api.md) for how it behaves during a session.

```tsx
import type { GanttHandle, GanttHistoryApi } from '@jaeungkim/gantt-chart';
```

## GanttHistoryApi

```ts
/** Imperative undo/redo API */
export interface GanttHistoryApi {
  /** Reverts the newest gesture and fires `onTasksChange`. No-op with an empty stack. */
  undo: () => void;
  /** Replays the newest undone gesture and fires `onTasksChange`. No-op with an empty stack. */
  redo: () => void;
  /** Whether there is a gesture to undo */
  canUndo: boolean;
  /** Whether there is an undone gesture to redo */
  canRedo: boolean;
}
```

| Member | Signature | Meaning |
|---|---|---|
| `undo` | `() => void` | Writes the previous values of the newest step back and fires `onTasksChange`. Empty stack: nothing happens, no callback, no throw |
| `redo` | `() => void` | Writes the values of the newest undone step back and fires `onTasksChange`. Empty stack: nothing happens |
| `canUndo` | `boolean` | `true` while the undo stack is non-empty |
| `canRedo` | `boolean` | `true` while the redo stack is non-empty |

`undo` and `redo` return `void`. The new task array reaches the host app through `onTasksChange`,
which fires only when a step was actually applied.

On the ref object, `canUndo` and `canRedo` are defined as getters, not copied booleans — each
property access reads the current stacks.

```tsx
const ref = useRef<GanttHandle>(null);

<button onClick={() => ref.current?.undo()} disabled={!ref.current?.canUndo}>Undo</button>
<button onClick={() => ref.current?.redo()} disabled={!ref.current?.canRedo}>Redo</button>
```

## historyLimit

```ts
/**
 * How many undo steps to keep (default 100)
 *
 * One completed gesture is one step, however many bars it moved. 0 turns undo off.
 */
historyLimit?: number;
```

| Value | Effect |
|---|---|
| omitted | `100` steps |
| any positive integer | that many steps; once full, the oldest step is dropped when a new one is pushed |
| `0` | Recording off, and both stacks are cleared at the moment the value is applied |
| any negative number | Identical to `0` |

Lowering the limit trims the undo stack to the newest `historyLimit` steps. It does not trim the
redo stack, so `canRedo` can stay `true` for more steps than the current limit allows.

`historyLimit` is applied in an effect rather than during the first render. The chart starts at
`100` and adopts the prop one commit later.

## What counts as one step

One completed gesture is one step, however many tasks it changed. A subtree drag that moved twenty
rows, and a move that cascaded a reschedule down a dependency chain, are each a single step.

A step stores only the fields that differ on the tasks that changed, not a copy of the task array.

These gestures record a step:

| Gesture | Recorded |
|---|---|
| Bar move or resize, including a whole-subtree drag and any cascading reschedule | yes |
| Progress-handle drag | yes |
| Row reorder, indent, outdent, re-parent | yes |
| Drawing a dependency link | yes |
| Deleting a dependency arrow | yes |
| Keyboard nudge (move or resize) and keyboard progress `+` / `-` | yes |
| Keyboard `Delete` / `Backspace` on a task | commits, but clears the stack — see [Constraints](#constraints) |
| Scale change, zoom, scroll, collapse, expand, selection | no — these are not task changes |

A gesture that ends with the task data unchanged is not a step. A field holding an object or an
array is compared by reference, so a gesture that mutated an array in place instead of replacing it
would record nothing; every built-in gesture builds a new array.

Pushing a new step clears the redo stack.

## Constraints

- A `tasks` prop whose content differs from what the chart currently holds clears both stacks. The
  comparison is `JSON.stringify` on both sides, so re-serialized dates, added or removed optional
  keys, and a different key order all count as different content. A controlled parent that hands
  back exactly what `onTasksChange` gave it keeps its history; one that rebuilds the array loses it
  on every gesture.
- A commit that changes the number of rows, or that makes a task id disappear, clears the whole
  stack. The step model expresses field changes on existing rows only. In practice this is the
  keyboard `Delete` / `Backspace` gesture: it removes the focused task and its subtree, the deletion
  itself cannot be undone, and every step recorded before it is discarded.
- `historyLimit` of `0` or lower clears both stacks. Raising the limit again brings nothing back.
- The stacks do not survive unmount, a page reload, or a host-driven `tasks` replacement. Nothing is
  persisted.
- `undo` and `redo` bypass `onBeforeTaskChange` — they write to the chart's own state directly, and
  cannot be vetoed or rewritten. See [Events and cancellable changes](../events.md).
- Undo and redo surface only as `onTasksChange`, indistinguishable from a drag commit. There is no
  `onUndo`, `onRedo`, or `onHistoryChange`.
- `canUndo` and `canRedo` do not subscribe to anything. Reading them re-renders nothing, and
  destructuring them (`const { canUndo } = ref.current!`) snapshots a stale boolean. Re-render the
  toolbar on `onTasksChange`, which fires on every change to them.
- The handle has no `clearHistory`, no way to push a step, and no way to read the stacks. `canUndo`
  and `canRedo` are the only observable history state.
- There is no transaction or batching API. One step is one completed gesture; a host app cannot
  merge several gestures into one step, nor split one gesture into several.
- `Ctrl/Cmd+Z` and `Ctrl/Cmd+Y` / `Ctrl/Cmd+Shift+Z` drive the same two methods, but only while
  focus is inside the chart, and never from inside an `input`, `textarea`, `select`, or
  `contenteditable`. The full key map is in
  [Keyboard and screen readers](../accessibility.md).

## Notes

The internals behind these types — the step list, the patch shape, the default-limit constant, and
the `useGanttHistoryApi` hook — are not exported from the package. `GanttHistoryApi` is exported as
a type only, so it can annotate a variable but cannot be used as a value.
