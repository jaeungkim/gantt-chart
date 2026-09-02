A task landed under the wrong phase, and the only fix in most charts is to edit a `parentId` in a
form somewhere else. Every app rebuilt that by hand. Now a row in the task list can be picked up and
dropped: moved among its siblings, pushed one level in, pulled one level out, or dropped onto
another row to become its child. The chart rewrites `parentId` and every affected `sequence`, and
hands your app one array to persist.

## Turning it on

Row dragging is off until `allowRowReorder` is set. It lives entirely in the task list pane, and that
pane is off by default, so `showTaskList` (or a `columns` array) has to be on as well; the pane is
covered in [Task list and hierarchy](task-list.md).

```tsx
// src/ProjectGantt.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  { id: 'root', name: 'Release 1', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: null, sequence: '1' },
  { id: 'a', name: 'Design', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-13T00:00:00Z', parentId: 'root', sequence: '1.1' },
  { id: 'a1', name: 'Wireframes', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-06T00:00:00Z', parentId: 'a', sequence: '1.1.1' },
  { id: 'a2', name: 'Visual design', startDate: '2026-03-09T00:00:00Z', endDate: '2026-03-13T00:00:00Z', parentId: 'a', sequence: '1.1.2' },
  { id: 'b', name: 'Build', startDate: '2026-03-16T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: 'root', sequence: '1.2' },
  { id: 'other', name: 'Launch prep', startDate: '2026-03-23T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: null, sequence: '2' },
];

export function ProjectGantt() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      showTaskList
      hierarchy
      allowRowReorder
    />
  );
}
```

A row is draggable only where a bar move would be allowed. The chart runs the same capability chain
it runs before a bar drag, and takes `canMove` from it, so `readOnly` on the chart or `allowMove:
false` on a task removes the row's grab cursor along with its bar drag; the chain itself is
documented in [Editing tasks](editing.md) and [GanttInteractionConfig](ref/interaction-config.md).

`hierarchy` is not required. The drop writes `parentId` either way; without it there are no summary
rows and nothing collapses.

## The gesture

A press on a row is still a click until the pointer travels 3px in either direction. After that the
row dims and an indicator follows the pointer.

Vertical movement picks the target row. Where inside that row the pointer sits decides whether the
drop inserts next to it or nests inside it. Rows are 38px tall, and the top and bottom 30% of a row
read as insertion bands.

| Pointer position in the row | Pixels from the row's top | Result |
|---|---|---|
| top 30% | 0 – 11.4 | insertion line **above** this row |
| middle 40% | 11.4 – 26.6 | **drop into** this row, which becomes the parent |
| bottom 30% | 26.6 – 38 | insertion line **below** this row |

The target row index is clamped to the list, so a pointer dragged above the first row resolves to the
line above it and a pointer dragged far below the last row resolves to the line below it.

### Indent and outdent

Horizontal travel since the press decides which level an insertion line lands at. One level is
`TREE_INDENT`, 16px, and the travel is rounded to the nearest level, so **the threshold for one
level is 8px**. The two directions are not symmetric: `+8px` already indents, while an outdent needs
strictly more than 8px of leftward travel, because JavaScript rounds a half up and `Math.round(-0.5)`
is `-0`.

The resulting depth is then clamped by two outliner rules:

- The deepest the row can land is one level below the row above the insertion line.
- It cannot land shallower than the row below the line, which would otherwise become its child.

Both clamps are hard. Ten indent widths of rightward travel still stops at one level below the row
above.

Once the depth is fixed, the new parent is the ancestor of the row above the line that sits one
level up. Depth 0, or no row above the line at all, means the root level. The position among the new
siblings is taken from the nearest sibling visible above the line; if there is none, the row lands
first. The dragged row is excluded from its own sibling list while this is computed, because it is
about to leave its current slot.

### Dropping onto a row

A drop in the middle band makes that row the parent and appends the dragged row **last** among its
children. The child count comes from the real tree, not from the screen, so dropping onto a
collapsed parent appends after its hidden children rather than in front of them.

### Invalid drops

A drop that would put a row inside its own subtree is refused. The blocked set is the dragged row
plus every descendant, so dropping a row onto itself is refused too. A refused drop in the middle
band recolours the target row and gives it a `no-drop` cursor; a refused insertion line only changes
colour, and the cursor stays `grabbing`. Releasing there does nothing at all — no commit, no
`onTasksChange`, and `onReorder` is not called either.

Two more cases end the gesture with nothing committed. A `pointercancel` — the browser taking the
gesture over as a scroll, or a second finger arriving — reverts the drag. And a drag that never
crossed the 3px threshold stays a click.

## What gets committed

On release the chart re-reads the current task array, applies the move, and rewrites the tree. If
the result is the array it started with — the row was dropped where it already was — nothing
happens.

Otherwise `onReorder` is called with a `GanttReorderChange`:

| Field | Type | What it holds |
|---|---|---|
| `task` | `Task` | The moved task, already carrying its new `parentId` and `sequence` |
| `parentId` | `string \| null` | The new parent; `null` is the root level |
| `previousParentId` | `string \| null` | The parent the task had in the incoming data, untouched by normalization |
| `index` | `number` | Zero-based position among the new parent's children |
| `sequence` | `string` | The moved task's new dotted sequence |
| `tasks` | `Task[]` | The whole updated array, the same one `onTasksChange` receives |

The full type is in [GanttReorderChange](ref/changes.md).

`previousParentId` is read from the pre-drag data rather than from the normalized tree, so a
`parentId` that pointed at a task that does not exist shows up here exactly as it was stored.

If the handler does not cancel, the chart commits once and calls `onTasksChange` once, with the same
array object that `change.tasks` carried. One reorder is therefore one undo step, however many rows
it renumbered; undo and redo are covered in [Imperative API](imperative-api.md).

### How sequence is rewritten

Row order comes from the dotted `sequence` and nesting comes from `parentId`, and those are two
independent fields; `sequence` itself is described in [Task data](task-data.md). A drop that changed
only `parentId` would snap back to its old place on the next sort, so the chart renumbers `sequence`
for the whole array from the resulting tree. Position among siblings, prefixed by the parent's
sequence: `1`, `1.1`, `1.2`, `2`.

Take the six tasks from the example above and drag `a1` out of `Design` to the root level, dropping
it on the line immediately above `Launch prep`. That is `parentId: null`, `index: 1`.

Before:

| id | `parentId` | `sequence` |
|---|---|---|
| `root` | `null` | `1` |
| `a` | `root` | `1.1` |
| `a1` | `a` | `1.1.1` |
| `a2` | `a` | `1.1.2` |
| `b` | `root` | `1.2` |
| `other` | `null` | `2` |

After:

| id | `parentId` | `sequence` |
|---|---|---|
| `root` | `null` | `1` |
| `a` | `root` | `1.1` |
| `a2` | `a` | `1.1.1` |
| `b` | `root` | `1.2` |
| `a1` | `null` | `2` |
| `other` | `null` | `3` |

Three rows have a new `sequence` and only one was dragged. `a2` moved up into the slot `a1` left,
and `other` was pushed down by the row that landed in front of it.

Two rules keep the rest of the array honest. `parentId` is written **only** on the moved task, so
every other row keeps the link it had. And rows whose `parentId` and `sequence` did not change keep
their object identity, so a `React.memo` downstream still sees them as unchanged.

A `parentId` pointing at a task that is missing, or at an ancestor loop, is never repaired. The row
keeps that link verbatim and is numbered as the root the chart already draws it as.

> [!WARNING]
> Returning `false` from `onReorder` cancels the drop: nothing is written to the chart, no undo step
> is recorded, and `onTasksChange` does not fire. The return value is read synchronously. An `async
> onReorder` returns a `Promise`, a `Promise` is never `=== false`, and the reorder commits before
> your handler resolves. A veto has to be decidable from data you already hold.

## Wiring onReorder to a server

The veto is synchronous, so the server call cannot gate the drop. The workable shape is optimistic:
refuse locally what you can decide locally, let the rest through, and roll back if the write fails.
`onReorder` runs before the commit, so the state you capture inside it is still the pre-move array.

```tsx
// src/ProjectGantt.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type GanttReorderChange,
  type Task,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

/** Phases the backend refuses to accept new children into. */
const FROZEN_PARENTS = new Set(['released']);

export function ProjectGantt({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);

  // Not wrapped in useCallback: it has to read the current `tasks` to roll back.
  function handleReorder(change: GanttReorderChange): boolean | void {
    if (change.parentId !== null && FROZEN_PARENTS.has(change.parentId)) {
      setError('That phase is released and cannot take new children.');
      return false;
    }

    const rollback = tasks;
    setError(null);

    // Every row after the move has a new sequence, so the whole array is sent.
    fetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movedId: change.task.id,
        parentId: change.parentId,
        index: change.index,
        order: change.tasks.map((task) => ({
          id: task.id,
          parentId: task.parentId,
          sequence: task.sequence,
        })),
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
      })
      .catch(() => {
        setTasks(rollback);
        setError('Could not save the new order.');
      });
  }

  return (
    <>
      {error !== null && <p role="alert">{error}</p>}
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        showTaskList
        hierarchy
        allowRowReorder
        onReorder={handleReorder}
      />
    </>
  );
}
```

Persisting only `change.task` loses the move. The rows that were renumbered around it are the ones
that hold the new order, so the array in `change.tasks` is what has to reach the database.

## When reorder turns itself off

Nothing warns you and no row shows a grab cursor. Each of these disables dragging on its own.

| Condition | Scope |
|---|---|
| `allowRowReorder` is left at its default `false` | whole chart |
| The task list pane is not rendered — neither `showTaskList` nor `columns` was passed, or `showTaskList={false}` | whole chart |
| The pane is collapsed with the toolbar toggle | until it is reopened |
| `groupBy` is set, so the row list contains group headers | whole chart |
| Two tasks share a `lane` without overlapping in time, so they are packed onto one row | whole chart |
| The task's resolved `canMove` is false — `readOnly`, or `allowMove: false` | that row |
| The press landed on a `<button>`, such as the collapse toggle | that press |
| The press is not the primary pointer's left button | that press |

The `groupBy` and `lane` cases are the surprising ones. The check is over the **entire** row list, so
a single group header or a single packed lane row disables row dragging for every row in the chart,
not only for the affected ones. Row ids are task ids only while every row is exactly one task, and a
reorder needs one task to move. Both features are described in
[Grouping and swimlanes](grouping.md).

A row inside a collapsed subtree is not rendered at all, so there is no row to press. Expand its
parent first.

## Limits

- **A reorder never touches a date.** Only `parentId` and `sequence` are written. A summary row's
  dates and progress are derived from its children, so re-parenting changes what rolls up where; see
  [Task list and hierarchy](task-list.md).
- **There is no keyboard equivalent.** Moving, resizing and progress all have one; reordering has
  none. The key map is in [Keyboard and screen readers](accessibility.md).
- **Row reorder does not go through `onBeforeTaskChange`.** That gate covers move, resize and
  progress only, and `onReorder` is the only hook here; see
  [Events and cancellable changes](events.md).
- **The drag does not scroll the pane.** There is no auto-scroll at the viewport edge, so the target
  row has to be scrolled into view before the drag starts.
- **Touch is unreliable.** A grid row sets no `touch-action`, so a vertical swipe can be taken over
  by the browser as a scroll, which fires `pointercancel` and reverts the drag.
- **A drag released in the row it started in still fires that row's click.** Bars swallow the click
  that ends a drag; the grid rows do not, so a pure indent or outdent also moves the selection.
  (Releasing over a different row fires the click on the row container instead, and no row handler
  runs.) `onTaskClick` and `onTaskSelect` are in [Events and cancellable changes](events.md).
- **One row at a time.** There is no multi-select drag. The dragged row always carries its whole
  subtree, and that is the only many-task move.
- **The tree is snapshotted at `pointerdown`.** Replacing the `tasks` prop mid-drag leaves the drop
  resolving against the tree as it was when the press started.
- **Bars cannot be dragged between rows.** Vertical bar dragging does not exist; the timeline pane
  only moves bars in time, as described in [Editing tasks](editing.md).
- **Persistence is yours.** The chart holds no order of its own. `onTasksChange` hands you an array
  and expects it back as the `tasks` prop.
- **Broken parent links are yours.** An orphaned or cyclic `parentId` is preserved through a
  reorder, never repaired, and never reported.
- **The first drag can move rows nobody dragged.** If the incoming `sequence` and `parentId`
  disagreed, the renumbering resolves them against the tree, so unrelated rows snap into the
  position their `parentId` always implied.

Next: [Events and cancellable changes](events.md), which covers the callbacks the rest of the chart
fires and the one gate that can stop a write before it lands.
