Bars tell you when something happens and never what it is. The task list is the pane on the left
that puts a name — and any other field you name — beside every row. It is also where `parentId`
becomes visible: with `hierarchy` on, a task that has children is drawn as a summary row whose
dates come from those children instead of from its own record.

## Turning the pane on

The pane is off by default. `showTaskList` turns it on. When `showTaskList` is omitted, passing
`columns` turns it on for you.

| `showTaskList` | `columns` | Pane | Columns used |
|---|---|---|---|
| omitted | omitted | hidden | — |
| omitted | given | shown | yours |
| `true` | omitted | shown | the three defaults |
| `true` | given | shown | yours |
| `false` | omitted | hidden | — |
| `false` | given | hidden | — |

An explicit `false` wins over `columns`. The same flag decides whether the toolbar's collapse
button exists at all.

```tsx
// ProjectChart.tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  { id: 'p1', name: 'Phase 1', parentId: null, sequence: '1',
    startDate: '2025-03-03', endDate: '2025-03-28' },
  { id: 't1', name: 'Design', parentId: 'p1', sequence: '1.1',
    startDate: '2025-03-03', endDate: '2025-03-12', progress: 100 },
  { id: 't2', name: 'Build', parentId: 'p1', sequence: '1.2',
    startDate: '2025-03-12', endDate: '2025-03-28', progress: 40 },
];

export function ProjectChart() {
  return <ReactGanttChart tasks={tasks} showTaskList height={420} />;
}
```

## The default columns

With the pane on and no `columns`, three columns render.

| # | `key` | Header | Width | Cell |
|---|---|---|---:|---|
| 0 | `name` | `Name` | 220 | `task.name` |
| 1 | `startDate` | `Start` | 110 | `startDate` formatted `YYYY-MM-DD` |
| 2 | `endDate` | `End` | 110 | `endDate` formatted `YYYY-MM-DD` |

Their widths add up to 440, which is the pane's starting width.

That date format is a string baked into the two default renderers. The `locale` prop does not
reach it — see [Locale and date formats](i18n.md) for what `locale` does change. To show dates any
other way, replace the column.

## Defining your own columns

`columns` replaces the defaults wholesale. There is no merge, and no way to override one of the
three and keep the rest.

Each entry is a `GanttColumn`: a `key`, a `header` node, an optional `width` in pixels defaulting
to 120, and an optional `render`. The full type is in [GanttColumn](ref/columns.md).

Without `render`, the cell shows `task[key]`. The lookup runs on the transformed row, not on the
`Task` you passed in, so derived fields work as keys with no renderer: `depth`, `order`,
`originalOrder`, `isSummary`, `barLeft`, `barWidth`. The critical-path fields — `earlyStart`,
`earlyFinish`, `lateStart`, `lateFinish`, `totalSlack`, `freeSlack`, `critical` and `duration` —
are present only while `criticalPath` is on, covered in [Scheduling](scheduling.md).

`null` and `undefined` both render as an empty string. Every other value goes through `String()`,
so `false` prints as `false`, `0` prints as `0`, and an object prints as `[object Object]`.

`key` is also the React key of the header cell and of each body cell. Two columns sharing a `key`
produce a duplicate-key warning.

```tsx
// taskListColumns.tsx
import type { GanttColumn, TaskTransformed } from '@jaeungkim/gantt-chart';

const dueFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function renderProgress(task: TaskTransformed) {
  const percent = Math.min(100, Math.max(0, task.progress ?? 0));

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          flex: '0 0 48px',
          height: 6,
          borderRadius: 3,
          background: '#e5e7eb',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${percent}%`,
            height: '100%',
            borderRadius: 3,
            background: '#2563eb',
          }}
        />
      </span>
      <span>{percent}%</span>
    </span>
  );
}

export const columns: GanttColumn[] = [
  { key: 'name', header: 'Task', width: 240 },
  { key: 'progress', header: 'Done', width: 140, render: renderProgress },
  {
    key: 'endDate',
    header: 'Due',
    width: 120,
    render: (task) => dueFormat.format(new Date(task.endDate)),
  },
];
```

## The tree column

Column index 0 is the tree column, and it is the only one. Four things attach to it and to nothing
else:

- an indent spacer of `depth * 16` pixels;
- the expander button on an expandable row, or a 20px spacer on every other row;
- a `+N` badge counting the extra tasks when a row holds more than one, which happens with lanes —
  see [Grouping and swimlanes](grouping.md);
- a native `title` tooltip carrying `task.name`, whatever your renderer put in the cell.

Widths behave differently there too. Column 0 is laid out as `flex: 1 1 <width>px` with a 60px
floor, so it absorbs whatever the splitter adds or removes. Every later column is
`flex: 0 0 <width>px` and never grows or shrinks. Widening the pane past the sum of the column
widths therefore only widens the first column.

Group header rows ignore `columns` completely and render one full-width cell instead; see
[Grouping and swimlanes](grouping.md).

## Resizing and collapsing the pane

| Control | Behaviour |
|---|---|
| Splitter drag | clamped to 120–800px, width at press plus the pointer's travel since press |
| Splitter keyboard | `ArrowLeft` / `ArrowRight` step 16px, same clamp |
| Splitter semantics | `role="separator"`, `aria-orientation="vertical"`, label `Resize task list` |
| Toolbar button | collapses and expands the pane, `aria-expanded` reflects the state |

The splitter sits outside the treegrid on purpose, so the grid keeps exactly one tab stop and the
splitter is a second, separate one. It is rendered only while the pane is visible, so collapsing
the pane removes the handle with it.

Pane width and collapsed state are local component state. There is no prop to seed either, no
callback when either changes, and neither survives a remount.

## Depth from parentId

`hierarchy` is `false` by default. Off, `parentId` is inert for rendering and the indentation you
see comes from the dots in `sequence`.

| | `hierarchy: false` | `hierarchy: true` |
|---|---|---|
| Row order | `sequence` | `sequence` — unchanged |
| Row depth | dot count in `sequence` | steps up the `parentId` chain |
| `isSummary` | never | a task with at least one child |
| Summary dates | raw values render | recomputed from the children |
| Task-row collapse | no expanders, `collapsedIds` inert for task ids | active |

Row order comes from `sequence` in both modes. `parentId` never moves a row. See
[Task data](task-data.md) for how `sequence` sorts.

## What a summary row's dates are

A summary's `startDate` is the earliest `startDate` among its children. Its `endDate` is the
latest `endDate` among them, except that a milestone child contributes its `startDate` for both
ends. The parent's own dates in your data are discarded on every render, silently.

Roll-up runs deepest first, so a grandchild's move travels up through the parent to the
grandparent. It also runs before the timeline fits its range and before grouping, so a child
reaching past its parent's stated dates still widens the timeline.

The recomputed values are re-serialized as full UTC ISO strings. A parent that came in as
`2025-03-04` comes back as `2025-03-04T00:00:00.000Z`, which matters if a `render` callback
compares the rendered date against your source string.

A parent whose children all carry unparseable dates keeps its own dates and no error is raised.

## What a summary row's progress is

An explicit `progress` on the parent is left alone. Only a missing one is rolled up, as a
duration-weighted average of the children.

| Rule | Value |
|---|---|
| Weight of one child | `endDate − startDate` in milliseconds, floored at 0 |
| Child with no or invalid `progress` | counts as 0%, but does not count as "reported" |
| No child reports a progress | the summary has none |
| Every child has zero duration | plain mean over the child count |
| Child progress outside 0–100 | clamped before weighting |
| Result | rounded to a whole percent |

Ten days at 100% plus thirty days at 0% rolls up to 25.

One asymmetry is worth knowing. A milestone child contributes only its `startDate` to the span,
but its raw `endDate` is still used as its progress weight. A milestone left with a far-future
`endDate` swamps the average while the span stays correct.

## What a summary row cannot do

Resizing and progress dragging are switched off on a summary row. Both are off unconditionally: a
per-task `allowResize: true` or `allowProgressChange: true` does not re-enable them, because the
summary guard sits outside the per-task precedence chain described in
[Editing tasks](editing.md). The reason is that a summary's dates are recomputed from its children
on the next render, so the edit would be thrown away.

The progress fill still draws. Only the drag handle is gone.

Moving is not affected. Dragging a summary bar moves its whole subtree by the same delta, bounded
by the intersection of every member's own drag window; see [Editing tasks](editing.md). The
scheduler also pins summary rows while `hierarchy` is on — see [Scheduling](scheduling.md).

A summary row carries the class `summary` on both its grid row and its bar. The word `summary` is
inserted into its accessible name, between the task name and the date range.

## Collapsing rows

Collapse state is one list of ids, in either controlled or uncontrolled mode.

| Prop | Mode | Rule |
|---|---|---|
| `collapsedIds` | controlled | an array here is what the chart shows, and internal state stops updating |
| `defaultCollapsedIds` | uncontrolled | read once, in the initial state; later changes are ignored |
| `onCollapsedChange` | both | fires on every toggle with the full next array |

The mode switch is `collapsedIds !== undefined`. `null` is not in the prop's type and is not an
opt-out: the pane falls back to the internal list to draw, but stops writing to it, so every
expander freezes while `onCollapsedChange` keeps firing. Passing both props means `collapsedIds`
wins and `defaultCollapsedIds` only seeds state nothing reads.

`onCollapsedChange` fires in controlled and uncontrolled mode alike, on a toggle and only on a
toggle. It never fires on mount, and never for `defaultCollapsedIds`. The payload is the whole
next array, never a delta: a newly collapsed id is appended at the end, and an expanded one is
filtered out.

> [!WARNING]
> In controlled mode the chart does not collapse anything on its own. It waits for a new
> `collapsedIds` array. Pass `collapsedIds` without handling `onCollapsedChange` and every
> expander looks broken.

A collapsed row stays on screen; its descendants disappear. Collapsing an id with no children is a
silent no-op, and the id stays in the list.

Toggles come from the expander button in the tree column, or from `ArrowRight` / `ArrowLeft` on the
first cell and `Enter` / `Space` anywhere on the row — see
[Keyboard and screen readers](accessibility.md).

The same list also holds group header ids, which are the string `group:` followed by the raw group
key; [Grouping and swimlanes](grouping.md) owns that. A row that holds several tasks in one lane
has the id `a+b`, which matches no task. Whether that row gets an expander is decided by its first
task alone, so a summary sharing a lane gets a toggle that hides nothing.

```tsx
// ProjectChart.tsx
import { useState } from 'react';
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';
import { columns } from './taskListColumns';

const tasks: Task[] = [
  { id: 'p1', name: 'Phase 1', parentId: null, sequence: '1',
    startDate: '2025-03-03', endDate: '2025-03-28' },
  { id: 't1', name: 'Design', parentId: 'p1', sequence: '1.1',
    startDate: '2025-03-03', endDate: '2025-03-12', progress: 100 },
  { id: 't2', name: 'Build', parentId: 'p1', sequence: '1.2',
    startDate: '2025-03-12', endDate: '2025-03-28', progress: 40 },
];

export function ProjectChart() {
  const [collapsedIds, setCollapsedIds] = useState<string[]>(['p1']);

  return (
    <ReactGanttChart
      tasks={tasks}
      columns={columns}
      hierarchy
      collapsedIds={collapsedIds}
      onCollapsedChange={setCollapsedIds}
      height={420}
    />
  );
}
```

## Edge cases

**A `parentId` naming a task that is not in the array.** The link is cut and the task renders as a
root. Nothing is logged, and no parent row is invented for it.

**A self-reference, or `parentId: ''`.** Both are roots. The empty string is a root because the
check is a falsy check, not a null check, so `''` is a legal way to say "no parent".

**A `parentId` cycle.** Every task in the cycle has its link cut and becomes a root. A task hanging
off the cycle — one whose parent is inside it — is rooted too, even though its own link looks fine.
The scheduler does not share this repair: it pins summaries by raw `parentId`, so members of a
cycle are pinned while the pane renders them as ordinary roots.

**A summary with an explicit `progress`.** It survives, including `0`, because the roll-up only
fills a nullish value. It is not clamped on the way through, so a stored `250` stays `250` in the
array your `render` sees while the bar draws at 100%. The progress handle stays hidden either way.

**Duplicate `id` values.** Nothing dedupes them. The duplicate is pushed into its parent's child
list twice and counted twice in the roll-up.

There is no depth cap. A chain twenty-five levels deep gives its last row a depth of 24, so 384px
of indent.

## Limits

The pane does not resize, reorder, hide, pin, sort or filter columns. `width` is fixed at render
time and only the pane itself is draggable. Cells are read-only nodes; there is no cell editor and
no `onCellChange`. There is no renderer for a grid row, a grid cell or a group header — the render
props cover the timeline side only, in [Custom rendering](custom-rendering.md). Rows are
virtualized, columns are not: every column renders for every visible row.

Pane width and collapse state have no props and are not persisted. The starting width is the sum of
the column widths, read once at mount: changing `columns` later does not resize the pane, and that
first width is not clamped, so columns summing to 2000 open a 2000px pane that snaps into the
120–800 range the first time the splitter moves. The layout constants — row height, default column
width, the 120–800 splitter range, the 16px indent — are not exported, so a host cannot import them
to match its own chrome.

Row reordering needs this pane: `allowRowReorder` does nothing while the pane is hidden or
collapsed — see [Reordering rows](reordering.md).

The tree does not order rows, and nothing checks that `sequence` agrees with `parentId`. A child
whose `sequence` sorts above its parent renders above it, indented, with wrong ARIA positions and
no warning. Broken parent links are repaired silently: there is no callback, no console message and
no flag on the row.

Roll-up covers `startDate`, `endDate` and a missing `progress`. It does not roll up `color`,
`className`, `dependencies`, baselines or `type`.

`collapsedIds` and `defaultCollapsedIds` do nothing for task ids while `hierarchy` is off. Group
ids keep working.

So the host app owns: keeping `sequence` consistent with `parentId`, holding the collapsed list in
state if it wants controlled collapse, persisting pane width and collapse itself, and validating
parent links before render. `buildTaskTree` is exported for that last one — see
[Headless core](headless-core.md).

Next: [Grouping and swimlanes](grouping.md), which stacks header rows above this tree.
