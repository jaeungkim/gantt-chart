Design hands back a screenshot where blocked tasks are amber, the client's tasks carry a brand blue,
and the timeline header marks every month boundary. None of that needs a fork. The chart
takes a color per task, a class name per task, and four render props that replace a node outright.
Each step up that list buys more control and costs more of the default behaviour.

## Per-task color

A `Task` carries an optional `color`. Any CSS color value is legal, including `var(--brand)` and
`rgb(255 0 0 / 50%)` — the string is passed through untouched. The rest of the field list is in
[Task data](task-data.md).

```tsx
// src/App.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02T00:00:00Z',
    endDate: '2026-03-06T00:00:00Z',
    parentId: null,
    sequence: '1',
    progress: 40,
    color: '#2563eb',
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2026-03-09T00:00:00Z',
    endDate: '2026-03-20T00:00:00Z',
    parentId: null,
    sequence: '2',
    progress: 0,
    color: 'var(--brand-amber)',
  },
];

export function App() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return <ReactGanttChart tasks={tasks} onTasksChange={setTasks} />;
}
```

One value colors the whole bar. The chart does not read a second token for the hover shade or the
progress fill; it derives both from the color you gave, so a colored bar never mixes in the theme
gray. A colored task sets exactly three CSS custom properties, inline on the bar node.

| Custom property | Value |
|---|---|
| `--gantt-bar-color` | the trimmed `color`, verbatim |
| `--gantt-bar-color-hover` | `color-mix(in srgb, <color> 86%, #000)` |
| `--gantt-progress-color` | `color-mix(in srgb, <color> 62%, #000)` |

The string is trimmed before it is used. A `color` that is `undefined`, `''` or whitespace emits no
properties at all, and that bar renders exactly like an uncolored one.

### Where the three properties are read

Each declaration names the task property first and a theme token as its `var()` fallback.

| Element | Declaration |
|---|---|
| bar background | `var(--gantt-bar-color, var(--gantt-bar-bg))` |
| bar background on hover | `var(--gantt-bar-color-hover, var(--gantt-bar-bg-hover))` |
| summary bar background | `var(--gantt-bar-color, var(--gantt-milestone-bg))` |
| summary bar on hover | `var(--gantt-bar-color-hover, var(--gantt-milestone-bg-hover))` |
| milestone diamond | `var(--gantt-bar-color, var(--gantt-milestone-bg))` |
| milestone diamond on hover | `var(--gantt-bar-color-hover, var(--gantt-milestone-bg-hover))` |
| progress fill | `var(--gantt-progress-color, var(--gantt-progress-bg))` |
| progress fill on a summary bar | `var(--gantt-progress-color, var(--gantt-foreground))` |

A summary bar and a milestone fall back to the milestone token, not the bar token. That is only
visible when the task has no `color`.

### When a color wins, and when it does not

The color wins over every theme token in the table above. The token is only a `var()` fallback, so
it is consulted when the task property is absent. Setting `--gantt-bar-bg` chart-wide through the
theme does not override a task's own `color`; see [Theming](theming.md) for the token list.

The color loses in three places.

- **A critical task.** With `criticalPath` on, `.gantt-task-bar.critical` sets `background` to
  `--gantt-critical-bg` outright, without consulting `--gantt-bar-color`. The hover shade, the
  progress fill and a critical milestone's diamond go the same way. The task's `color` reappears the
  moment the task leaves the critical path or `criticalPath` is turned off. Critical-path marking is
  covered in [Scheduling](scheduling.md).
- **Anything that is not a background.** The bar's text color, its radius, its shadow, the
  selection outline and the dependency arrows all come from theme tokens. `color` changes the eight
  background declarations in the table above and nothing else.
- **The task list.** `color` never reaches the left pane. A row in the task list is styled by the
  theme and by `className`.

## className

`className` on a task is put on that task's bar and on its row in the task list. It is appended last
in both class strings, which changes nothing about the cascade — the order of names in a `class`
attribute is not a CSS ordering. A rule of yours wins the way any rule wins: on specificity, or on
coming later at equal specificity. `.gantt-task-bar.blocked` outranks `.gantt-task-bar`, which is
why the example is written that way.

```tsx
const task: Task = {
  id: 'audit',
  name: 'Security audit',
  startDate: '2026-04-06T00:00:00Z',
  endDate: '2026-04-10T00:00:00Z',
  parentId: null,
  sequence: '3',
  className: 'blocked',
};
```

```css
/* src/gantt-overrides.css */
.gantt-task-bar.blocked {
  background: repeating-linear-gradient(
    45deg,
    #b45309,
    #b45309 6px,
    #92400e 6px,
    #92400e 12px
  );
}

.gantt-grid-row.blocked .gantt-grid-cell {
  font-style: italic;
}
```

`className` is not applied when `renderBar` is set. That branch returns before the class string is
built, so a custom bar has to read `task.className` and re-apply it.

## The four render props

Past the two cheap options there are four escape hatches. Each replaces one node completely.

| Prop | Replaces | Spread onto your root |
|---|---|---|
| `renderBar` | the whole bar or milestone node, tooltip included | `barProps` |
| `renderTooltip` | the tooltip node inside the default bar | nothing to spread |
| `renderHeaderCell` | one timeline header cell, both rows | `cellProps` |
| `renderBaseline` | the baseline bar | nothing to spread |

The complete type shapes are in [Renderers](ref/renderers.md).

### renderBar

`renderBar` gets the task, the geometry the default bar would have used, and a `barProps` bag. The
task is a `TaskTransformed`, which is the input task plus computed geometry and roll-up fields; see
[Task](ref/task.md).

Four of the values it receives need reading carefully.

| Value | What it actually is |
|---|---|
| `left` | `barLeft` plus the live drag offset, in px from the timeline origin |
| `width` | the drag-adjusted width, floored at 14px — a bar is never narrower, however short the task |
| `height` | 19px, which is the bar height, not the row height (rows are 38px) |
| `progress` | the live 0–100 value during a progress drag, otherwise `task.progress` clamped to 0–100, `null` when the task has none |

For a milestone, `left` is the unshifted value, while `barProps.style.transform` translates the node
to `left - 11px` — 11 is the distance from the diamond's center to its vertex. Positioning from
`left` yourself puts the milestone 11px right of where the default sits.

`barProps` carries `style`, `onPointerDown`, `onClick` and `onDoubleClick`. Spread all four onto
your root node.

```tsx
// src/App.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type GanttBarRenderProps,
  type Task,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02T00:00:00Z',
    endDate: '2026-03-06T00:00:00Z',
    parentId: null,
    sequence: '1',
    progress: 40,
    color: '#2563eb',
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2026-03-09T00:00:00Z',
    endDate: '2026-03-20T00:00:00Z',
    parentId: null,
    sequence: '2',
    progress: 0,
  },
];

function Bar({ task, progress, isSelected, barProps }: GanttBarRenderProps) {
  const classes = [
    'app-bar',
    isSelected ? 'selected' : '',
    task.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...barProps}
      id={`task-${task.id}`}
      data-task-id={task.id}
      role="gridcell"
      aria-label={`${task.name}, ${task.startDate} to ${task.endDate}`}
      className={classes}
    >
      {progress !== null && (
        <div className="app-bar-progress" style={{ width: `${progress}%` }} />
      )}
      <span className="app-bar-label">{task.name}</span>
    </div>
  );
}

export function App() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      renderBar={(props) => <Bar {...props} />}
    />
  );
}
```

`barProps.style` already carries the `transform`, the height, the cursor and the three color custom
properties, plus the width for everything that is not a milestone. The chart wraps every bar in an
absolutely positioned flex row that supplies the vertical placement, so `app-bar` only has to supply
the paint.

What breaks when a piece of `barProps` is left off:

| Left off | Consequence |
|---|---|
| `style` | The bar is not positioned, has no size, has no cursor, and loses the per-task color properties |
| `onPointerDown` | The bar cannot be moved or resized, by mouse or by touch |
| `onClick` | `onTaskClick` never fires, the bar can never be selected, and the click that ends a drag is no longer swallowed |
| `onDoubleClick` | `onTaskDoubleClick` never fires |

> [!WARNING]
> `barProps` does not carry everything the default bar has. A `renderBar` replacement loses the
> dependency link handles, the progress handle, the milestone diamond, the hover state, the resize
> cursor, every library class including `task.className`, and — because `tabIndex` and the cell
> coordinate are not in the props bag at all — keyboard reachability, which cannot be rebuilt from
> what you are given.

The full list of what a custom bar gives up:

- **The two connector dots.** Dependency arrows are drawn by dragging from a bar's link handle, so
  with `renderBar` set there is no way to draw a link with the pointer. Existing arrows still
  render; see [Dependencies](dependencies.md).
- **The progress fill and its drag handle.** `progress` is handed to you as a number, but the
  gesture that edits it lives on a handle that is not in `barProps`.
- **`tabIndex` and `data-gantt-cell`.** The chart's focus manager finds a bar by its cell
  coordinate, and neither the coordinate nor the tab index is passed to the renderer. Arrow-key
  navigation stops reaching bars. See [Keyboard and screen readers](accessibility.md).
- **`id="task-<id>"`.** Every task-list row's `aria-owns` points at that id. Re-add it, as the
  example does, or the treegrid's row-to-bar ownership breaks.
- **`role="gridcell"` and `aria-label`.** Screen readers announce nothing about the bar until you
  supply both.
- **`ref` and `onMouseMove`.** The default bar switches the cursor to a resize cursor inside the
  edge zones. The resize gesture itself still works through `onPointerDown`, measured against your
  node's own box, but there is no cursor affordance for it.
- **`onMouseEnter` / `onMouseLeave`.** Nothing tracks hover, which is why the hover tooltip is gone.
- **Every class:** `gantt-task-bar` (or `gantt-milestone`), `dragging`, `compact`, `summary`,
  `no-resize`, `critical`, `link-target valid|invalid`, `selected`, `reverting`, and
  `task.className`. None of the stylesheet applies.
- **`renderTooltip`.** It is never called when `renderBar` is set. A replacement owns the tooltip
  too.

### renderTooltip

`renderTooltip` replaces the tooltip node inside the default bar, for hover and for drags alike.
There is no props bag and nothing to spread.

`reason` says why the tooltip is showing, resolved most specific first.

| `reason` | When |
|---|---|
| `progress` | the progress handle is being dragged |
| `resize` | a bar drag is running on the left or right edge |
| `move` | a bar drag is running on the body of the bar |
| `hover` | the pointer is over the bar and nothing is being dragged |

When none of those hold, the renderer is not called at all.

`startDate` and `endDate` are dayjs objects. During a gesture they are the live preview values, not
the values in your `tasks` array — the array is only written on release, which is covered in
[Editing tasks](editing.md). For a milestone `endDate` equals `startDate`, so `durationMs` is `0`.

```tsx
// src/App.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type GanttTooltipRenderProps,
  type Task,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02T00:00:00Z',
    endDate: '2026-03-06T00:00:00Z',
    parentId: null,
    sequence: '1',
    progress: 40,
  },
];

function Tooltip({
  task,
  reason,
  startDate,
  endDate,
  durationMs,
  progress,
}: GanttTooltipRenderProps) {
  const days = Math.round(durationMs / 86_400_000);
  const live = reason !== 'hover';

  return (
    <div
      className="gantt-bar-tooltip"
      role={live ? 'status' : 'tooltip'}
      aria-live={live ? 'polite' : undefined}
    >
      <strong>{task.name}</strong>
      <div>
        {startDate.format('MMM D')} – {endDate.format('MMM D')} ({days}d)
      </div>
      {progress !== null && <div>{progress}% done</div>}
    </div>
  );
}

export function App() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      renderTooltip={(props) => <Tooltip {...props} />}
    />
  );
}
```

The returned node is appended as the last child of the bar, and `.gantt-bar-tooltip` is what
positions it: `position: absolute`, 8px below the bar, centred, with the arrow and the fade-in. Drop
that class and the node becomes an ordinary flex child laid out inside the bar — a replacement that
wants its own look has to position itself.
The default gesture tooltip is a `role="status"` live region and the default hover tooltip is a
`role="tooltip"`, so a replacement that omits both is silent to a screen reader.

### renderHeaderCell

Both header rows go through the same renderer, so the first thing a replacement does is branch on
`row`. `'top'` is a merged group label, `'bottom'` a single tick. `label` is the string the default
would have printed, with the locale and any format overrides already applied; see
[Locale and date formats](i18n.md).

```tsx
// src/GanttHeaderCell.tsx
import { type GanttHeaderCellRenderProps } from '@jaeungkim/gantt-chart';

// Wire it up as renderHeaderCell={(props) => <HeaderCell {...props} />}
export function HeaderCell({
  row,
  date,
  label,
  cellProps,
}: GanttHeaderCellRenderProps) {
  if (row === 'top') {
    return (
      <div {...cellProps}>
        <p className="gantt-top-group-label">{label}</p>
      </div>
    );
  }

  return (
    <div
      {...cellProps}
      style={{ ...cellProps.style, fontWeight: date.date() === 1 ? 700 : undefined }}
      title={date.format('YYYY-MM-DD')}
    >
      {label}
    </div>
  );
}
```

`cellProps` is a `className` and a `style`. The class is `gantt-top-group` on the top row and
`gantt-bottom-cell` on the bottom one; the style is nothing but an explicit pixel width. Adding a
style of your own means merging into `cellProps.style`, as the bottom branch does, never replacing
it.

`date` is a UTC dayjs object — the merged group's start on the top row, the tick's start on the
bottom one. The chart registers the `utc` plugin and nothing else, so plugin methods such as
`isoWeek()` are not available on it.

| Left off | Consequence |
|---|---|
| `style` | The cell has no width. Both rows are flex rows, so the cell auto-sizes and every cell after it shifts — the header stops lining up with the bars underneath |
| `className` | The cell keeps its width but loses the borders and the typography the stylesheet gives it |

The result is wrapped in a keyed fragment by the chart, so the renderer does not need to supply a
`key`. The bottom row is virtualized: the renderer is called for visible ticks only, and the top
row's merged group labels are always present.

### renderBaseline

`renderBaseline` is the odd one out: a plain `(task: TaskTransformed) => ReactNode` with no props
bag, nothing to spread and no `left` or `width` argument, so the renderer positions the element
horizontally from `task.baselineLeft` and `task.baselineWidth` itself. It runs only for tasks that
carry `baselineStart`, and returning `null` renders the default baseline instead of hiding it;
baselines are covered in [Scheduling](scheduling.md).

## showTooltip

`showTooltip` defaults to `true`. Setting it to `false` suppresses the hover tooltip and the live
tooltip during a move, a resize and a progress drag.

It also suppresses `renderTooltip`. The flag is checked before the reason is resolved, so a custom
tooltip and `showTooltip={false}` together render nothing at all. If the goal was a quieter tooltip
rather than no tooltip, leave the flag alone and return a smaller node from `renderTooltip`.

Turning tooltips off removes the only live-region announcement a pointer drag produces — the gesture
tooltip is that `role="status"` node. Keyboard date edits are announced by a separate live region
that `showTooltip` does not touch; see [Keyboard and screen readers](accessibility.md).

## Limits

- **There are four render props, and no more.** There is no renderer for a task-list row, a group
  header, the toolbar, the drag guides, the drop indicator or the dependency arrows — those are
  reachable through CSS only. A task-list *cell* is the exception: its body comes from
  `columns[].render`, covered in [Task list and hierarchy](task-list.md).
- **`renderBar` cannot be scoped to some tasks.** It is one chart-wide prop, called for every bar
  and every milestone. Branch inside the renderer and return your own markup for the tasks you care
  about — there is no way to ask for the default node back.
- **A custom bar is your accessibility problem.** The id, the role, the label and the keyboard
  wiring are not restored for you, and the keyboard wiring cannot be restored at all.
- **A custom bar is your dependency-drawing problem.** The link handles are gone, and there is no
  imperative API for creating a link. Arrows can still be created from your own UI by writing
  `dependencies` into the task array.
- **`renderHeaderCell` cannot change the header height.** The 44px group row and the 28px tick row
  are fixed heights; a taller cell overflows.
- **Colors are not computed for you.** There is no palette, no color-by-status and no legend. The
  chart reads `task.color` and derives two shades from it, and every other rule is yours.
- **`color-mix` is required for the derived shades.** The hover and progress shades are emitted as
  `color-mix(in srgb, …)`, so a browser that cannot parse `color-mix` cannot resolve either of them.
  `--gantt-bar-color` is a plain color and keeps working there.

Reach for the three options in that order. The three CSS custom properties handle anything that is a
color, and `color` on a task sets all three from one value. `className` handles anything the
stylesheet can express — a pattern, a border, a font. A render prop is the last resort, because it
is the only option that takes capabilities away, and `renderBar` takes away the most.

Next: [Imperative API](imperative-api.md), which covers the `ref` handle — scrolling, zooming,
undo and PNG export.
