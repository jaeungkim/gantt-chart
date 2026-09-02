`GanttProps` is the full prop surface of `ReactGanttChart`. It and every type named in the tables
below are exported from the package root, apart from `Dayjs`, `ReactNode` and `React.MouseEvent`,
which come from `dayjs` and `react`:

```tsx
import { ReactGanttChart, type GanttProps } from '@jaeungkim/gantt-chart';
```

Every prop is optional. The Default column carries the value the component actually falls back to;
`none` means the prop has no fallback and the feature it drives stays off.

## Data

| Prop | Type | Default | Description |
|---|---|---|---|
| `tasks` | `Task[]` | `[]` | The task array. See [Task data](../task-data.md). |
| `onTasksChange` | `(updatedTasks: Task[]) => void` | none | Fires with the whole array after any committed edit. See [Editing tasks](../editing.md). |

## Layout and size

| Prop | Type | Default | Description |
|---|---|---|---|
| `height` | `number \| string` | `600` | Chart height, a number in px or any CSS length. See [Quick start](../quick-start.md). |
| `width` | `number \| string` | `"100%"` | Chart width, a number in px or any CSS length. See [Quick start](../quick-start.md). |
| `className` | `string` | none | Appended to the container's `gantt-container` class. See [Theming](../theming.md). |

## Task list

| Prop | Type | Default | Description |
|---|---|---|---|
| `showTaskList` | `boolean` | `columns !== undefined` | Shows the left pane. See [Task list and hierarchy](../task-list.md). |
| `columns` | `GanttColumn[]` | `DEFAULT_COLUMNS` — Name / Start / End | Column definitions for the pane. See [Task list and hierarchy](../task-list.md) and [GanttColumn](columns.md). |

## Hierarchy and grouping

| Prop | Type | Default | Description |
|---|---|---|---|
| `hierarchy` | `boolean` | `false` | Derives depth and summary rows from `parentId`. See [Task list and hierarchy](../task-list.md). |
| `collapsedIds` | `string[]` | none — the chart keeps its own list | Controlled collapsed set. See [Task list and hierarchy](../task-list.md). |
| `defaultCollapsedIds` | `string[]` | `[]` | Uncontrolled seed, read once on mount. See [Task list and hierarchy](../task-list.md). |
| `onCollapsedChange` | `(collapsedIds: string[]) => void` | none | Fires on every collapse toggle, controlled or not. See [Task list and hierarchy](../task-list.md). |
| `groupBy` | `GanttGroupBy` | none | Groups rows into swimlanes. See [Grouping and swimlanes](../grouping.md) and [GanttGroupBy](grouping.md). |
| `ungroupedLabel` | `string` | `"Ungrouped"` | Header label for tasks with no group value. See [Grouping and swimlanes](../grouping.md). |

## Timeline and range

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultScale` | `GanttScaleKey` | `"month"` — only when no scale is stored under `storageKey` | Seed scale for a fresh session. See [The timeline](../timeline.md). |
| `visibleStart` | `string` | none — the range fits the tasks | Pins the timeline's start to this ISO date. See [The timeline](../timeline.md). |
| `visibleEnd` | `string` | none — the range fits the tasks | Pins the timeline's end to this ISO date. See [The timeline](../timeline.md). |
| `showNonWorkingDays` | `boolean` | `true` | Shades weekends and holidays. See [The timeline](../timeline.md). |
| `holidays` | `string[]` | none — no dates are treated as holidays | ISO date strings shaded as non-working. See [The timeline](../timeline.md). |
| `isNonWorkingDay` | `(date: Dayjs) => boolean` | none — the weekend plus `holidays` check is used | Replaces the built-in non-working-day test. See [The timeline](../timeline.md). |
| `markers` | `GanttMarker[]` | `[]` | Labelled vertical lines at given dates. See [The timeline](../timeline.md) and [GanttMarker](markers.md). |
| `rangeBands` | `GanttRangeBand[]` | `[]` | Shaded bands covering a date range. See [The timeline](../timeline.md) and [GanttRangeBand](markers.md). |
| `onRangeChange` | `(range: GanttDateRange) => void` | none | Fires whenever the rendered range changes. See [The timeline](../timeline.md). |

## Zoom and scrolling

| Prop | Type | Default | Description |
|---|---|---|---|
| `zoomOnWheel` | `boolean` | `false` | Ctrl/Cmd + wheel steps through the scale ladder. See [The timeline](../timeline.md). |
| `infiniteScroll` | `boolean` | `false` | Grows the rendered range when either end is approached. See [The timeline](../timeline.md). |
| `initialScrollTo` | `"today" \| string` | none | Scrolls once, after the timeline first renders. See [Imperative API](../imperative-api.md). |
| `autoScrollOnDrag` | `boolean` | `true` | A bar drag at a viewport edge scrolls the timeline. See [Editing tasks](../editing.md). |

## Editing permissions

| Prop | Type | Default | Description |
|---|---|---|---|
| `readOnly` | `boolean` | `false` | Blocks moving, resizing and progress dragging on every task. See [Editing tasks](../editing.md). |
| `allowMove` | `boolean` | `!readOnly` | Allows moving bars, overriding `readOnly`. See [Editing tasks](../editing.md). |
| `allowResize` | `boolean` | `!readOnly` | Allows resizing bars, overriding `readOnly`. See [Editing tasks](../editing.md). |
| `allowProgressChange` | `boolean` | `!readOnly` | Allows dragging the progress handle, overriding `readOnly`. See [Editing tasks](../editing.md). |
| `allowTaskCreate` | `boolean` | `!readOnly` | Allows drawing a new task on empty row space. See [Editing tasks](../editing.md). |
| `allowRowReorder` | `boolean` | `false` | Allows dragging a task list row to reorder and re-parent. See [Reordering rows](../reordering.md). |
| `minDate` | `string` | none | Earliest ISO date any bar may be dragged to. See [Editing tasks](../editing.md). |
| `maxDate` | `string` | none | Latest ISO date any bar may be dragged to. See [Editing tasks](../editing.md). |

## Dependencies

| Prop | Type | Default | Description |
|---|---|---|---|
| `allowLinkCreate` | `boolean` | `!readOnly` | Allows drawing dependencies between bars. See [Dependencies](../dependencies.md). |
| `allowLinkDelete` | `boolean` | `!readOnly` | Allows selecting and deleting dependency arrows. See [Dependencies](../dependencies.md). |
| `onDependencyCreate` | `(change: GanttDependencyChange) => boolean \| void` | none | Runs before a drawn link is applied; `false` rejects it. See [Dependencies](../dependencies.md). |
| `onDependencyDelete` | `(change: GanttDependencyChange) => boolean \| void` | none | Runs before an arrow is removed; `false` keeps it. See [Dependencies](../dependencies.md). |

## Scheduling

| Prop | Type | Default | Description |
|---|---|---|---|
| `schedulingPolicy` | `SchedulingPolicy` | `"off"` | How a move propagates to successors. See [Scheduling](../scheduling.md). |
| `onSchedulingCycle` | `(taskIds: string[]) => void` | none | Fires with the ids caught in a dependency cycle. See [Scheduling](../scheduling.md). |
| `workingCalendar` | `boolean` | `false` | Routes every date calculation through a working-day calendar. See [Scheduling](../scheduling.md). |
| `criticalPath` | `boolean` | `false` | Computes the critical path and fills in the slack fields. See [Scheduling](../scheduling.md). |

## Rendering

| Prop | Type | Default | Description |
|---|---|---|---|
| `renderBar` | `GanttBarRenderer` | none — the built-in bar is used | Replaces the bar node entirely. See [Custom rendering](../custom-rendering.md) and [Renderers](renderers.md). |
| `renderTooltip` | `GanttTooltipRenderer` | none — the built-in tooltip is used | Replaces the hover and drag tooltip node. See [Custom rendering](../custom-rendering.md) and [Renderers](renderers.md). |
| `renderHeaderCell` | `GanttHeaderCellRenderer` | none — the built-in header cell is used | Replaces a timeline header cell in both rows. See [Custom rendering](../custom-rendering.md) and [Renderers](renderers.md). |
| `renderBaseline` | `(task: TaskTransformed) => ReactNode` | none — the built-in baseline bar is used | Replaces the baseline bar for tasks carrying `baselineStart`. See [Scheduling](../scheduling.md). |
| `showTooltip` | `boolean` | `true` | Shows the hover and drag tooltips. See [Custom rendering](../custom-rendering.md). |

## Events

| Prop | Type | Default | Description |
|---|---|---|---|
| `onTaskClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` | none | Fires on a bar or row click, not after a drag. See [Events and cancellable changes](../events.md). |
| `onTaskDoubleClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` | none | Fires on a double click. See [Events and cancellable changes](../events.md). |
| `onTaskSelect` | `(task: TaskTransformed \| null) => void` | none | Fires when the selection changes, `null` on an empty-timeline click. See [Events and cancellable changes](../events.md). |
| `selectable` | `boolean` | `onTaskSelect !== undefined` | Turns click-to-select and its highlight on. See [Events and cancellable changes](../events.md). |
| `onBeforeTaskChange` | `GanttBeforeChangeHandler` | none | Runs before a move, resize or progress change is written, and can cancel it. See [Events and cancellable changes](../events.md) and [Changes](changes.md). |
| `onTaskCreate` | `(draft: GanttTaskDraft) => void` | none | Fires with the range drawn on empty row space. See [Editing tasks](../editing.md). |
| `onReorder` | `(change: GanttReorderChange) => void \| boolean` | none | Runs before a row drop is committed; `false` cancels it. See [Reordering rows](../reordering.md). |

## Locale and theme

| Prop | Type | Default | Description |
|---|---|---|---|
| `locale` | `string` | none — the built-in English labels are used | BCP 47 tag for every date label. See [Locale and date formats](../i18n.md). |
| `formats` | `GanttFormatOverrides` | none — the locale's labels are used | Per-scale `tick` / `header` / `tooltip` label overrides. See [Locale and date formats](../i18n.md). |
| `firstDayOfWeek` | `number` | none — week grouping is off | `0` = Sunday .. `6` = Saturday, groups the week scale's top header. See [Locale and date formats](../i18n.md). |
| `theme` | `GanttTheme` | none — no theme class is attached | `'light'`, `'dark'` or `'system'`. See [Theming](../theming.md). |

## Storage

| Prop | Type | Default | Description |
|---|---|---|---|
| `storageKey` | `string` | `"gantt-scale"` | sessionStorage key the scale selection is stored under. See [The timeline](../timeline.md). |
| `historyLimit` | `number` | `100` | Undo steps kept; `0` turns undo off. See [Imperative API](../imperative-api.md). |

## Defaults that are not what they look like

- **`showTaskList`** has no fixed default. Left out, the pane is on exactly when `columns` is
  given. Passing `columns` alone turns the pane on; passing `showTaskList: true` alone shows it
  with `DEFAULT_COLUMNS`.
- **`selectable`** has no fixed default either. Left out, selection is on exactly when
  `onTaskSelect` is given. Pass `true` for the highlight without a callback, `false` to turn it
  off entirely.
- **`allowMove`, `allowResize`, `allowProgressChange`, `allowTaskCreate`, `allowLinkCreate`,
  `allowLinkDelete`** default to `!readOnly`, not to `true`. A task's own flag of the same name
  wins over the chart-level one, and a task's own `readOnly` sits between them. See
  [GanttInteractionConfig](interaction-config.md).
- **`allowTaskCreate`** on its own draws nothing: `onTaskCreate` must also be given.
- **`defaultScale`** is a seed, not a controlled value. A scale the user picked is saved under
  `storageKey` in sessionStorage and wins on remount, and changes to the prop after mount are
  ignored.
- **`collapsedIds`** and **`defaultCollapsedIds`** are the controlled and uncontrolled halves of
  one value. Passing `collapsedIds` makes the chart show that list and stop tracking its own;
  `onCollapsedChange` still fires in both modes.
- **`theme`** left out attaches no theme class at all — the host app decides. `'system'` resolves
  to `null` during server rendering and the first hydration render, then to the real setting.
- **`historyLimit: 0`** does not mean unlimited. It empties the stack and turns undo off.
- **`storageKey`** is one key for the whole page. Two charts that leave it at `"gantt-scale"`
  share a scale, and the last change made applies to both.
- **`visibleStart`** and **`visibleEnd`** are independent. Pinning one end also stops
  `infiniteScroll` from extending the range on that side; the other side still extends.
- **`workingCalendar`** builds its calendar from `holidays` and `isNonWorkingDay`, the same
  configuration that drives `showNonWorkingDays` shading.

## Notes

- `DEFAULT_COLUMNS` is an internal constant, not a public export. It names the fallback columns in
  the table above but cannot be imported from the package — pass your own `columns` array instead.
  See [Task list and hierarchy](../task-list.md).
- `Dayjs` comes from the `dayjs` package, and `ReactNode` / `React.MouseEvent` from `react`.
  None of the three is re-exported from this package.
- `ReactGanttChart` also takes a `ref` of type `GanttHandle` for scrolling, zooming, undo/redo and
  PNG export. It is not part of `GanttProps` — see [GanttHandle](handle.md).
