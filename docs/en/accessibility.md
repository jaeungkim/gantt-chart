Someone tabs into the chart and lands on a single cell. From there one handler on the
`role="treegrid"` element reads every key press, decides whether it owns it, and hands back what it
does not. It owns fourteen keys. Eight of them write task data, and they write it without asking your
`onBeforeTaskChange` handler first. Most of what a pointer can do on this chart has no key at all.

## The key map

The handler runs on the treegrid element only. Every key it claims is `preventDefault`ed before any
work happens, so `Alt+ArrowLeft` never navigates the browser back. Every key it does not claim
bubbles out untouched.

| Key | Modifiers | What happens |
|---|---|---|
| `ArrowDown` | any | Focus the same column one row down. Stops at the last row. |
| `ArrowUp` | any | Focus the same column one row up. Stops at row 0. |
| `ArrowRight` | no `Alt`, no `Shift` | On column 0 of a collapsed expandable row, expand it. Otherwise focus the next cell, clamped to the row's last cell. |
| `ArrowLeft` | no `Alt`, no `Shift` | On column 0 of an expanded expandable row, collapse it. Otherwise focus the previous cell, clamped to column 0. |
| `ArrowLeft` / `ArrowRight` | `Alt` | Move the focused task one step earlier or later. Both dates shift. |
| `ArrowLeft` / `ArrowRight` | `Shift` | Move the end date one step. Resizes from the right edge. |
| `ArrowLeft` / `ArrowRight` | `Alt`+`Shift` | Move the start date one step. Resizes from the left edge. |
| `Home` | no `Ctrl`/`Cmd` | First cell of the current row. |
| `Home` | `Ctrl` or `Cmd` | First cell of the first row. |
| `End` | no `Ctrl`/`Cmd` | Last cell of the current row. |
| `End` | `Ctrl` or `Cmd` | Last cell of the last row. |
| `Enter` / `Space` | any | An expandable row toggles. Any other row announces its task's label, without the progress. |
| `Delete` / `Backspace` | any | Delete the focused row's task and every descendant of it. |
| `+` / `=` | any | Progress up 5 points. |
| `-` / `_` | any | Progress down 5 points. |
| everything else | — | Returned to the browser. `Tab`, `Escape`, `PageUp`, `PageDown`, `F2` and every letter are not handled here. |

Arrow navigation clamps and never wraps. `Ctrl`+`End` is the only jump to another row that reads
the column from the row it lands on. `ArrowUp` and `ArrowDown` carry the column they started with,
clamped against the row they left.

### A modifier turns an arrow into an edit

The handler tests `Alt` and `Shift` on a horizontal arrow before it reads that arrow as navigation.
So `Shift+ArrowRight` is a resize, not a range selection, and there is no range selection to reach.
`Ctrl` and `Cmd` are not consulted on the arrows at all, which leaves `Ctrl+ArrowRight` as plain
cell navigation.

### What one step is

The step is the current scale's drag step, read at the moment of the press.

| Scale | One press of an editing arrow |
|---|---|
| `hour` | 15 minutes |
| `day` | 1 hour |
| `week` | 6 hours |
| `month` | 1 day |
| `quarter` | 3 days |
| `year` | 7 days |

The same step drives a pointer drag, and the same snapping rules apply; see
[Editing tasks](editing.md). The rest of each scale's configuration is in
[The timeline](timeline.md). The step is added in calendar units, so a press across a daylight-saving
boundary keeps the task's wall-clock time of day.

Zooming changes what every editing key does. One `Alt+ArrowRight` is fifteen minutes on the `hour`
scale and seven days on the `year` scale, and nothing announces the change.

## Which keys a read-only chart still answers

Every editing key resolves the same per-task capability a drag resolves. The four-rung precedence
chain from `task.allowX` down to `config.readOnly` is explained in [Editing tasks](editing.md).

| Keys | Capability consulted |
|---|---|
| `Alt`+`ArrowLeft` / `ArrowRight` | `canMove` |
| `Shift` and `Alt`+`Shift` arrows | `canResize` |
| `+` `=` `-` `_` | `canChangeProgress` |
| `Delete` / `Backspace` | `canMove` |
| arrows, `Home`, `End`, `Enter`, `Space` | none — navigation and expand/collapse work on a fully frozen chart |

There is no delete capability. A task that may move may be deleted.

A milestone never resizes, and a summary row never resizes and never takes a progress step; those
two structural rules override every flag and are described in [Editing tasks](editing.md). A task
with no `progress` field is also refused: the keyboard steps an existing number, it does not create
one.

```tsx
// src/App.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  {
    id: 'frozen',
    name: 'Frozen',
    startDate: '2026-03-02T00:00:00Z',
    endDate: '2026-03-06T00:00:00Z',
    parentId: null,
    sequence: '1',
    progress: 0,
  },
  {
    id: 'editable',
    name: 'Editable',
    startDate: '2026-03-09T00:00:00Z',
    endDate: '2026-03-20T00:00:00Z',
    parentId: null,
    sequence: '2',
    progress: 40,
    allowMove: true,
    allowProgressChange: true,
    maxDate: '2026-03-31T00:00:00Z',
  },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(initial);

  // Alt+arrow and +/- work on 'editable' only. On 'frozen', Alt+arrow announces
  // "Frozen cannot be changed" and +/- announces "Frozen progress cannot be changed".
  // Alt+ArrowRight stops once 'editable' ends on its maxDate, and announces
  // "Editable cannot be changed" from then on.
  return <ReactGanttChart tasks={tasks} readOnly onTasksChange={setTasks} />;
}
```

## The ARIA tree

The task list and the timeline are one treegrid, not two. The row lives in the task list, and it
claims its bars in the timeline through `aria-owns`.

```text
section.gantt-container               tabIndex=-1, undo/redo key handler
├─ div.gantt-toolbar
│  ├─ button.gantt-grid-toggle        aria-expanded, aria-label="Expand|Collapse task list"
│  └─ div                             role=group, aria-label="Timeline scale"
│     └─ button × 6                   aria-pressed, tabIndex=0 on the active one
├─ div.gantt-sr-only                  role=status, aria-live=polite
└─ div.gantt-main
   ├─ div.gantt-scroll-container
   │  └─ div.gantt-body               role=treegrid, aria-label="Gantt chart", aria-rowcount
   │     ├─ div.gantt-grid            role=presentation
   │     │  ├─ div.gantt-grid-header  role=row, aria-rowindex=1
   │     │  │  ├─ div × columns       role=columnheader
   │     │  │  └─ span                role=columnheader, "Timeline", visually hidden
   │     │  └─ div.gantt-grid-body    role=rowgroup
   │     │     └─ div.gantt-grid-row  role=row, aria-level, aria-posinset, aria-setsize,
   │     │        │                   aria-rowindex, aria-expanded?, aria-owns?
   │     │        └─ div × columns    role=gridcell, tabIndex 0 or -1
   │     │           └─ button        expander, tabIndex=-1, aria-hidden=true
   │     └─ div.gantt-timeline        role=presentation
   │        └─ div.gantt-content      role=presentation
   │           ├─ div.gantt-rows      role=presentation
   │           │  └─ div.gantt-task-row  aria-hidden=true, striping only
   │           └─ div#task-<id>       role=gridcell, tabIndex 0 or -1, aria-label
   └─ div.gantt-grid-splitter         role=separator, aria-orientation=vertical, tabIndex=0
```

`aria-level` is 1-based. `aria-posinset` and `aria-setsize` count only the rows no collapsed parent
is hiding, so collapsing a parent renumbers its siblings. `aria-rowcount` is that same row count plus
one for the header row, not the total in your data.

`aria-expanded` is omitted, not set to `false`, on a row that cannot expand. A summary row only
counts as expandable when `hierarchy` is on; with `hierarchy={false}` the attribute disappears and
`Enter` announces the row instead of toggling it. See
[Task list and hierarchy](task-list.md).

`aria-owns` is omitted when the row has no bars. A group header row from `groupBy` always has none;
see [Grouping and swimlanes](grouping.md).

### Without the task list pane

The pane is absent in three cases: `showTaskList={false}`, neither `showTaskList` nor `columns`
set, and someone pressing the toolbar toggle. All three change the same four things, and the third
changes them while the user is in the chart.

- There is no column-header row, so `aria-rowcount` loses its `+1` and the first data row is
  `aria-rowindex={1}`.
- There is no `role="rowgroup"` anywhere. The rows sit directly inside `role="presentation"`
  wrappers.
- Cell column 0 is the first bar rather than the first task-list column.
- A group header row's single cell moves out of the task list into the timeline row.

### What is never emitted

Nothing in the chart sets `aria-colindex`, `aria-colcount`, `aria-selected`, `aria-current`,
`aria-multiselectable`, `aria-describedby` or `aria-labelledby`, and no element carries
`role="treeitem"`. A cell therefore never reports its column position, and selection is never
exposed to assistive technology at all.

The bar's link handles are `role="button"` with `tabIndex={-1}`. Its progress handle is
`role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` — and `tabIndex={-1}`, so no
keyboard ever reaches it.

## What a screen reader hears

A bar's `aria-label` is built from four parts in a fixed order: the name, then `milestone` or
`summary`, then the date or date range, then the progress. `milestone` wins over `summary`, and the
progress part appears only when the task has one and is not a milestone.

The dates are formatted with the current scale's tooltip formatter — the same one the drag tooltip
uses. So the label changes with the scale, and overriding `formats[scale].tooltip` rewrites what is
spoken. See [Locale and date formats](i18n.md).

| Task | Scale | Emitted `aria-label` |
|---|---|---|
| `Design phase`, 40% | `month` | `Design phase, Mar 3, 2025 to Mar 14, 2025, 40% complete` |
| `Design phase`, 40% | `day` | `Design phase, Mar 3, 2025 00:00 UTC to Mar 14, 2025 00:00 UTC, 40% complete` |
| `Launch`, `type: 'milestone'` | `month` | `Launch, milestone, Mar 3, 2025` |
| `Phase 1`, `isSummary`, Mar to May | `quarter` | `Phase 1, summary, Mar 2025 to May 2025` |

Edits are announced through a single `role="status" aria-live="polite"` region, which sits in the
container between the toolbar and the chart body.

| Key | Announcement |
|---|---|
| `Alt`/`Shift` arrow, accepted | `Design phase, Mar 3, 2025 to Mar 15, 2025` |
| `Alt`/`Shift` arrow, refused | `Design phase cannot be changed` |
| `+` or `-`, accepted | `Design phase, 45% complete` |
| `+` or `-`, refused | `Design phase progress cannot be changed` |
| `Delete`, accepted | `Design phase deleted` |
| `Delete`, refused | `Design phase cannot be deleted` |
| `Enter` on a non-expandable row | the full label, with the progress omitted |
| `Enter` on an expandable row | nothing |

## Focus

Inside the treegrid there is exactly one tab stop: the cell whose row and column match the chart's
focus state. Every other cell is `tabIndex={-1}`. The rendered component contributes up to four tab
stops to the page.

| # | Element | Present when |
|---|---|---|
| 1 | the task-list toggle button | the grid pane is enabled |
| 2 | the active scale button | always |
| 3 | the roving treegrid cell | a cell matching the focus state is rendered |
| 4 | the task-list splitter | the grid pane is visible |

The container `<section>` is `tabIndex={-1}`. It takes focus from a click so the undo shortcut is in
scope, and it is not a tab stop.

A row's cells are numbered left to right: the task-list columns first, then one cell per bar on the
row. A group header row has exactly one cell.

Clicking a cell syncs the focus state to it. A keyboard move does the opposite: it sets the state,
then hunts for the matching element three times — once immediately, then on the next two animation
frames — scrolling the row and the task into view between attempts. If no element matches on the
third try, it gives up and DOM focus stays where it was.

Nothing is focused on mount. The first `Tab` that reaches the treegrid lands on cell `0:0`, and if
`tasks` is empty there is no cell to land on.

### Keyboard focus is not selection

Arrowing onto a bar does not select it. `onTaskSelect` never fires, `selectedTaskId` never changes,
and no `aria-selected` is written. Selection is a pointer-only concept here; see
[Events and cancellable changes](events.md).

## Keys handled outside the treegrid

| Keys | Where the listener is | What it does |
|---|---|---|
| `Ctrl`/`Cmd`+`Z`, `Ctrl`/`Cmd`+`Y`, `Ctrl`/`Cmd`+`Shift`+`Z` | the container `<section>` | Undo and redo. Ignored when `Alt` is held, or when the target is an `input`, `textarea`, `select` or contenteditable. See [Imperative API](imperative-api.md). |
| `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` | each scale button | Move to the previous or next scale and change the scale immediately. Wraps around all six. |
| `ArrowLeft` / `ArrowRight` | the splitter | Resize the task list by 16px, clamped between 120px and 800px. |
| `Delete` / `Backspace`, `Escape` | `document`, while a dependency arrow is selected | Delete or deselect the arrow, from anywhere on the page. Skipped inside an `input`, `textarea`, `select` or contenteditable. |

## Gaps

This is the part to read before promising keyboard parity to anyone.

**Four pointer gestures have no keyboard equivalent.** Drawing a dependency arrow is unreachable:
the link handles are `tabIndex={-1}`. Selecting an arrow, and therefore deleting one, needs a click.
Row reorder is `onPointerDown`-driven, so `onReorder` cannot fire from a keyboard. Drawing a new task
on empty row space is pointer-only, so `onTaskCreate` cannot either. See
[Dependencies](dependencies.md) and [Reordering rows](reordering.md).

**Keyboard edits bypass `onBeforeTaskChange`.** That handler is wired into the pointer drag hooks
only. A keyboard nudge, progress step or delete commits unconditionally and never waits on an async
veto. If you use it to enforce a business rule, the rule holds for drags and does not hold for the
keyboard. See [Events and cancellable changes](events.md).

> [!WARNING]
> A keyboard delete is not undoable and it clears the undo history. The history diff only tracks
> edits that keep the array length, so removing a task returns no diff and the store resets past and
> future to empty. `Delete` also removes every descendant, whether or not `hierarchy` is on, and it
> fires from any cell in the row — including the Name cell — with no confirmation step.

**Not every refused key is announced.** A refusal from a capability check is announced. A key that
lands on a row with no task is not: the handler calls `preventDefault`, finds no task, and returns
in silence. Group header rows are exactly this case, so `Delete`, `+`, `-` and the editing arrows are
swallowed on them with no feedback.

**A cell reference can point at nothing.** The focus column is not clamped when the row changes.
Moving down from a two-bar row onto a one-bar row keeps a column index that row does not have, no
element matches, and the chart loses its only tab stop until someone clicks a cell. `Home` and `End`
recover it while focus is still inside the treegrid. The same failure appears when a bar is scrolled
out horizontally: bars outside the viewport are not rendered, but the row's `aria-owns` still lists
their ids.

**An out-of-range column edits the wrong bar.** Resolving a task from a cell falls back to the row's
first task. On a multi-lane row a stale column silently acts on lane 0 instead of doing nothing. The
same fallback is why `Delete` on a task-list cell deletes that row's task.

**The treegrid handler has no text-entry guard.** Undo and redo skip form fields; this handler does
not. A custom `GanttColumn.render` that returns an `<input>` sits inside a `role="gridcell"`, and
`ArrowLeft`, `ArrowRight`, `Home`, `End`, `Delete`, `Backspace`, `+` and `-` are all intercepted
inside it. The caret does not move and those characters are never typed. Inline editing in a
task-list column does not work.

**A toggle is not announced.** `Enter` on an expandable row changes `aria-expanded` on the row while
focus sits on a cell, and writes nothing to the live region.

## Limits

- **No key remapping, no opt-out.** Nothing in the keyboard layer is exported from the package.
  There is no prop to change a binding, to disable keyboard editing separately from pointer editing,
  or to render something other than a treegrid.
- **No `PageUp` / `PageDown`, no type-ahead, no `F2` edit mode, no multi-select, no `Escape` inside
  the treegrid.**
- **No focus trap and no skip link.** `Tab` leaves the treegrid on the first press, and a chart with
  many rows offers no way to jump past it other than the browser's own.
- **No high-contrast support.** The stylesheet has no `forced-colors` and no `prefers-contrast`
  block. `prefers-reduced-motion` is honoured: inside the chart, transitions and
  animations are cut to 0.01ms and `scroll-behavior` becomes `auto`.
- **Confirmation is yours.** `Delete` removes a subtree immediately. If that needs a dialog, keep
  your own snapshot in `onTasksChange` and restore from it, because the chart's undo stack is gone.
- **Announcement wording is fixed.** The strings above are hardcoded in English. Only the dates
  inside them follow the `locale` and `formats` props.
- **Testing is yours.** Nothing here is verified against a real screen reader in this repository;
  the coverage is unit tests over the key resolver and the ARIA prop builders.

Next: [Locale and date formats](i18n.md), which covers the formatter these labels and announcements
run through.
