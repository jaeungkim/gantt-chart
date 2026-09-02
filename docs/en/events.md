A user drags a bar three days later and lets go. Your server has the last word on whether that date
is allowed, and it takes 300ms to answer. Until it answers, the bar has to stay where it was
dropped. If the answer is no, it has to go back. `onBeforeTaskChange` is the gate that makes that
possible, and this page is its full contract. It also covers the callbacks that only report -
clicks, double clicks and selection - and names the edit paths that never pass through the gate.

## Clicks and selection

Three callbacks and one flag cover pointer attention. The callbacks are wired to the bar and to that
task's row in the task list, so a click in either pane is the same event with the same argument.

| Prop | Signature |
|---|---|
| `onTaskClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` |
| `onTaskDoubleClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` |
| `onTaskSelect` | `(task: TaskTransformed \| null) => void` |
| `selectable` | `boolean` |

`TaskTransformed` is the task plus the layout fields the chart computed for it; its shape is in
[Task](ref/task.md).

```tsx
// src/ProjectGantt.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

export function ProjectGantt({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [inspected, setInspected] = useState<TaskTransformed | null>(null);

  return (
    <>
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        onTaskClick={(task) => console.log('clicked', task.id)}
        onTaskDoubleClick={(task) => console.log('open editor for', task.id)}
        onTaskSelect={setInspected}
      />
      <aside>{inspected ? inspected.name : 'Nothing selected'}</aside>
    </>
  );
}
```

### Selection is on when you ask a question about it

There is no `selectable` default to memorize. Passing `onTaskSelect` turns selection on, and
`selectable` overrides that in either direction.

| `selectable` | `onTaskSelect` | Selection |
|---|---|---|
| omitted | omitted | off |
| omitted | given | on |
| `true` | omitted | on, highlight only |
| `true` | given | on |
| `false` | given | off, and `onTaskSelect` is never called |

The last row is the one that surprises people. `selectable={false}` does not mean "silent
selection", it means the whole selection path exits before your handler.

Inside one click the order is fixed: `onTaskClick` fires first, then the selection changes. And
`onTaskSelect` fires only when the selected id actually changes. Clicking a row that is already
selected fires `onTaskClick` and nothing else.

The highlight is a class, not a callback. The selected row gets `.gantt-grid-row.selected` and the
selected bar gets `.gantt-task-bar.selected`.

### Clicking the empty timeline clears the selection

A click that lands on the timeline background itself clears the selection, which calls
`onTaskSelect(null)` when a task was selected. Clicking the background twice fires once, because the
id has to change. The row backgrounds, the non-working-day shading and the range bands do not block
the click, because none of them take pointer events.

Two places do not clear it. A click on the empty area of the task list pane does nothing, and
neither does a click on a group label drawn in the timeline - it is the one element in that layer
that takes pointer events back, and it is only rendered while the task list pane is hidden.

### A drag's trailing click is swallowed on a bar, not on a row

The browser fires a click after the pointerup that ended a drag. On a bar the chart drops that
click, so a finished drag never fires `onTaskClick` and never changes the selection. The flag it
checks is set only when the snapped drag step count actually changed, so a press and a jiggle that
never crossed one step is still a click. Drag steps are per scale and are covered in
[Editing tasks](editing.md).

> [!WARNING]
> The task list has no equivalent guard. A row drag that really moved a row still fires
> `onTaskClick` for that row on the pointerup that dropped it. If your click handler opens a panel,
> reordering a row will open it.

The collapse toggle is exempt in both directions. A press on it does not start a row drag, and the
toggle stops the event before it can become a selection.

### A double click fires both of its clicks

There is no click-count debounce anywhere in the chart. A double click on a bar fires `onTaskClick`
twice and then `onTaskDoubleClick` once. If single click does real work and double click opens an
editor, the real work runs twice before the editor opens.

## onBeforeTaskChange

`onBeforeTaskChange` runs after a pointer gesture has produced a result and before anything is
written. It covers three gestures: a move, a resize and a progress drag.

```ts
// The two types behind onBeforeTaskChange
import type { GanttTaskChange } from '@jaeungkim/gantt-chart';

type GanttChangeType = 'move' | 'resize' | 'progress';

type GanttBeforeChangeHandler = (
  change: GanttTaskChange
) => boolean | void | Promise<boolean | void>;
```

It is called once per gesture, with the change object untouched. A gesture that never committed a
drag step never reaches it, and writes nothing either.

### What the change object carries

| Field | What it is |
|---|---|
| `type` | `'move'`, `'resize'` or `'progress'` |
| `task` | the bar the user grabbed, already in its post-change shape |
| `changedTasks` | only the tasks this gesture rewrites |
| `previousTasks` | those same tasks as they were before, in the same order |
| `tasks` | the whole array as it stood at drop, with the change already applied |
| `edge` | `'start'` for a left resize, `'end'` for a right resize, `undefined` otherwise |

`tasks` is a drop-time snapshot, not a promise about the future. Its JSDoc calls it the array
`onTasksChange` would receive, but a commit re-merges against the live tasks, so the two can differ
when something else committed while your answer was in flight. Send `changedTasks` to a server, not
`tasks`.

`changedTasks` and `previousTasks` line up index for index, both in render order, so you can diff
them without a lookup. They can differ in length in one case: an id in `changedTasks` that has no
entry in the previous array is dropped from `previousTasks` rather than left as a hole.

`changedTasks` is wider than the grabbed bar in two situations. Dragging a summary bar carries its
whole subtree. With auto-scheduling on, the cascade is recomputed at drop and every successor it
pushed is in the array, so your handler approves the whole downstream effect in one call. Tasks the
gesture did not touch never appear. The policy that decides the cascade is in
[Scheduling](scheduling.md).

The exact type declarations are in [Changes](ref/changes.md).

### What an answer means

| Handler returns | Result |
|---|---|
| nothing (`undefined`) | commit |
| `true` | commit |
| `false` | roll back |
| a promise resolving to `false` | roll back when it settles |
| a promise resolving to anything else | commit when it settles |
| a rejected promise | roll back |
| a synchronous `throw` | roll back |

Only an explicit `false` is a veto. A handler with no return statement commits, which is what makes
`onBeforeTaskChange` safe to use as a plain observer.

A rejection and a throw both roll back, so a `fetch` that never resolves and a handler with a bug in
it look identical to the chart. Return `false` for a business rejection and let a network failure
throw; both undo the gesture, but only the first one is a decision.

The answer is always applied on a later microtask, even for a synchronous handler, because the chart
awaits the return value. Nothing is applied inside the `pointerup` itself.

### While the answer is pending

Nothing is disabled and nothing is frozen. The bar stays exactly where the user dropped it, because
the drag offsets that put it there are deliberately not cleared. The user can grab it again, grab
another bar, or scroll. A pending progress drag behaves the same way: the fill stays where the user
let go, and only the handle stops looking grabbed.

A rollback writes nothing, because nothing was ever written. On a bar it drops the drag offsets of
the grabbed bar and of every cascaded successor, and if the drag auto-scrolled the viewport it
scrolls that back too. On a progress handle it drops the preview, so the stored value shows again.
Both mark the affected bars `reverting` for 200ms, so the snap back is a CSS transition rather than
a jump.

A commit reads the task array as it is at commit time, not the snapshot taken at drop. With
auto-scheduling on it recomputes the cascade from the live predecessors instead of replaying the
drop-time result. An edit that landed elsewhere while your veto was in flight therefore survives.

### A late answer for a bar the user has already moved again

Each task has two gate lanes. A move and a resize share the `dates` lane, so they supersede each
other. A progress edit has its own lane, so a pending date decision and a pending progress decision
never cancel each other.

A gesture claims its lane on its first committed movement. When the handler finally answers, the
chart checks whether a newer gesture on that lane claimed it in the meantime. If one did, the answer
is dropped: no commit, no rollback, no undo step, nothing. Without that rule a slow veto would drag
a bar the user has since moved somewhere else back to a position nobody asked for.

The gate is created once per chart, so two charts on one page have independent lanes.

### An optimistic update with a server round trip

The gesture is already on screen when your handler starts. That is the optimism. The round trip
either confirms it or takes it away.

```tsx
// src/ServerBackedGantt.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type GanttTaskChange,
  type Task,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

async function persist(change: GanttTaskChange): Promise<boolean> {
  const response = await fetch('/api/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: change.type,
      edge: change.edge ?? null,
      // The whole cascade, not only the grabbed bar
      tasks: change.changedTasks.map((task) => ({
        id: task.id,
        startDate: task.startDate,
        endDate: task.endDate,
        progress: task.progress ?? null,
      })),
    }),
  });

  // 409 from the server is a business rejection, not a transport failure
  if (response.status === 409) return false;
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return true;
}

export function ServerBackedGantt({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        schedulingPolicy="shift-on-overlap"
        onBeforeTaskChange={async (change) => {
          setError(null);
          try {
            const accepted = await persist(change);
            if (!accepted) {
              setError(`${change.task.name} conflicts with another booking.`);
              return false; // bar animates back, onTasksChange never fires
            }
          } catch (cause) {
            // A throw rolls back too, so the screen never keeps an unsaved edit
            setError('Could not reach the server. Your change was undone.');
            throw cause;
          }
          // No return value: the gesture commits and onTasksChange fires next
        }}
      />
    </>
  );
}
```

Two details are worth naming. The chart hands you `change.changedTasks`, so one request covers the
grabbed bar, its subtree and the cascade; you never reconstruct that list. And `onTasksChange` fires
once per gesture with the full array, after the commit, so your state update is the last step rather
than a race with the veto.

## How a veto composes with undo

Undo works on steps recorded inside the chart. A step is recorded at commit time and only at commit
time, which makes the rule short.

| Outcome | Written to the tasks | Undo step | `onTasksChange` |
|---|---|---|---|
| commit | yes | one, however many tasks moved | fires once |
| roll back | no | none | does not fire |
| superseded (late answer) | no | none | does not fire |

So a vetoed drag leaves the history exactly as it was. The user's next Ctrl+Z undoes whatever they
did before the rejected gesture, not the rejected gesture. That is the intended behaviour: there is
nothing to undo, because nothing happened.

Undo and redo do not re-enter `onBeforeTaskChange`. They replay a step that your handler already
approved, and they call `onTasksChange` with the result. If your server needs to hear about an undo,
it hears about it there.

Two things clear the history. Handing the chart a `tasks` prop whose contents differ from what the
chart currently holds is treated as the host replacing the data, and the stack is dropped. An echo
of what `onTasksChange` handed you is not that, so the ordinary controlled loop is safe. If your
server normalizes dates and you feed the normalized rows back, expect the history to reset.

The other is a commit that adds or removes rows. An undo step is a field patch, and no field patch
can put a deleted row back, so that commit drops the stack instead of recording a step. The keyboard
delete is the built-in edit that does it: pressing Delete removes the task and its subtree and
leaves nothing to undo. What one undo step is, and `historyLimit`, are in
[Imperative API](imperative-api.md).

## Edits that never reach onBeforeTaskChange

`onBeforeTaskChange` is a gate on three pointer gestures, not on the chart. Five other edit paths
sit outside it.

| Path | Gate it uses instead | Async veto? |
|---|---|---|
| Keyboard nudge, keyboard progress step, keyboard delete | **none** | n/a |
| Drawing a new task on empty row space | `onTaskCreate`, which cannot veto because the chart adds nothing itself | no |
| Drawing a dependency arrow | `onDependencyCreate`, return `false` to cancel | no |
| Deleting a dependency arrow | `onDependencyDelete`, return `false` to cancel | no |
| Reordering a row | `onReorder`, return `false` to cancel | no |

The keyboard row is the important one. `Alt` with an arrow key moves a bar, `Shift` resizes it, `+`
and `-` step its progress, and `Delete` removes it. Every one of those commits straight to the tasks
and fires `onTasksChange`. Your veto handler is not called. If a rule must hold for every edit,
enforce it in `onTasksChange` as well, or turn the gesture off through the permission chain in
[Editing tasks](editing.md). The full key map is in
[Keyboard and screen readers](accessibility.md).

The three link and reorder callbacks do veto, but synchronously: the chart reads the return value
immediately, so a promise is truthy and commits. Returning a promise from `onReorder` in the hope of
asking a server first does not work. Their payloads are covered in [Dependencies](dependencies.md)
and [Reordering rows](reordering.md).

## Limits

- **Selection is one id, and it is internal.** There is no multi-select and no `selectedTaskId`
  prop. You cannot set the selection, restore it after a remount, or clear it from your own code.
  Track it yourself from `onTaskSelect` if you need it outside the chart.
- **There is no context-menu, hover or focus callback.** Right click is not reported. If you need a
  context menu, put your own handler on a bar through `renderBar`; see
  [Custom rendering](custom-rendering.md).
- **A veto explains nothing to the user.** The bar animates back for 200ms and that is the entire
  feedback. Any message, toast or highlight is yours to render.
- **The handler cannot rewrite the change.** It answers yes or no and nothing else. There is no way
  to accept a gesture with adjusted dates - snap the values yourself in `onTasksChange` after the
  commit.
- **There are no drag lifecycle callbacks.** No `onDragStart`, `onDragMove` or `onDragEnd`, and
  nothing for a row drag either. `onBeforeTaskChange` and `onReorder` fire at the end of a gesture
  and nowhere else.
- **A keyboard delete cannot be undone.** Removing rows is not a field patch, so that commit drops
  the whole undo stack instead of recording a step.
- **The chart does not retry, queue or debounce your handler.** One gesture is one call. Two
  gestures in flight on the same bar mean two requests, and the older answer is discarded rather
  than cancelled - your request still runs to completion.
- **No `AbortSignal` is passed in.** If a superseded round trip should be cancelled, hold your own
  controller keyed by task id.
- **A pending veto does not lock anything.** The user can drag the same bar again while your server
  is still thinking, and nothing warns them. If a gesture must be exclusive, disable the bar
  yourself while the request is open.
- **Persistence is yours.** Nothing is stored and nothing is sent anywhere. `onTasksChange` hands
  you an array and expects it back as the `tasks` prop.
- **A progress drag cancelled by the browser commits.** A bar drag cancelled the same way reverts.
  That asymmetry is in [Editing tasks](editing.md).

## Every event in one table

| The user does this | Callback | Can it cancel? |
|---|---|---|
| Clicks a bar or its row | `onTaskClick`, then `onTaskSelect` | no |
| Double clicks a bar or its row | `onTaskClick` twice, then `onTaskDoubleClick` | no |
| Clicks the empty timeline | `onTaskSelect(null)`, if something was selected | no |
| Finishes a drag on a bar | nothing - the trailing click is dropped | n/a |
| Moves a bar | `onBeforeTaskChange` (`type: 'move'`), then `onTasksChange` | yes, async |
| Resizes a bar | `onBeforeTaskChange` (`type: 'resize'`, `edge` set), then `onTasksChange` | yes, async |
| Drags the progress handle | `onBeforeTaskChange` (`type: 'progress'`), then `onTasksChange` | yes, async |
| Edits with the keyboard | `onTasksChange` only | no |
| Draws a task on empty row space | `onTaskCreate` | n/a, the chart writes nothing |
| Draws a dependency arrow | `onDependencyCreate`, then `onTasksChange` | yes, sync |
| Deletes a dependency arrow | `onDependencyDelete`, then `onTasksChange` | yes, sync |
| Reorders a row | `onReorder`, then `onTasksChange` | yes, sync |
| Undoes or redoes | `onTasksChange` only | no |
| Changes the rendered timeline range | `onRangeChange` - see [The timeline](timeline.md) | no |

Next: [Custom rendering](custom-rendering.md), which replaces the bar, the tooltip and the header
cell without giving up any of the behaviour on this page.
