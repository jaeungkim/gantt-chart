# @jaeungkim/gantt-chart — documentation

Read in order if you are new. Jump straight to a guide if you are not.

## Guides

| Page | What it covers |
|---|---|
| [Introduction](introduction.md) | What the library is, and what it deliberately leaves to you |
| [Concepts and vocabulary](concepts.md) | Every term the rest of the docs use, defined once |
| [Quick start](quick-start.md) | Install to a working, editable chart |
| [Task data](task-data.md) | The `Task` shape, date handling, and how the `tasks` prop is compared |
| [Task list and hierarchy](task-list.md) | The left pane, columns, and the `parentId` tree |
| [Grouping and swimlanes](grouping.md) | `groupBy`, group header rows, and lanes |
| [The timeline](timeline.md) | Scales, range, zoom, markers, and non-working days |
| [Editing tasks](editing.md) | Move, resize, progress, permissions, touch, and drawing a task |
| [Dependencies](dependencies.md) | The four link types, lag, and drawing arrows |
| [Scheduling](scheduling.md) | Auto-scheduling, the working calendar, critical path, baselines |
| [Reordering rows](reordering.md) | Dragging rows to reorder and re-parent |
| [Events and cancellable changes](events.md) | Callbacks, and vetoing an edit before it commits |
| [Custom rendering](custom-rendering.md) | Per-task colors and the four render props |
| [Imperative API](imperative-api.md) | The `ref` handle: scrolling, zoom, undo/redo, PNG export |
| [Keyboard and screen readers](accessibility.md) | The key map, the ARIA tree, and the gaps |
| [Locale and date formats](i18n.md) | `locale`, per-scale overrides, week start |
| [Theming](theming.md) | The theme prop and the CSS custom properties |
| [Headless core](headless-core.md) | Scheduling without React or a DOM |

## Reference

| Page | Symbols |
|---|---|
| [GanttProps](ref/props.md) | every prop the component accepts |
| [Task and task types](ref/task.md) | `Task`, `TaskDependency`, `DependencyType`, `TaskType`, `TaskTransformed` |
| [GanttInteractionConfig](ref/interaction-config.md) | `GanttInteractionConfig` and the capability order |
| [GanttColumn](ref/columns.md) | `GanttColumn` |
| [Grouping types](ref/grouping.md) | `GanttGroupBy`, `GanttRow`, `GanttRowGroup` |
| [Markers and range bands](ref/markers.md) | `GanttMarker`, `GanttRangeBand`, `GanttDateRange` |
| [Render prop types](ref/renderers.md) | `GanttBarRenderer`, `GanttTooltipRenderer`, `GanttHeaderCellRenderer` |
| [Change and draft types](ref/changes.md) | `GanttTaskChange`, `GanttReorderChange`, `GanttDependencyChange`, `GanttTaskDraft` |
| [GanttHandle](ref/handle.md) | `GanttHandle`, `GanttScrollApi`, `GanttScrollOptions`, `GanttZoomAnchor` |
| [GanttHistoryApi](ref/history.md) | `GanttHistoryApi` |
| [PNG export](ref/export.md) | `GanttExportApi`, `GanttExportOptions`, `GanttExportRange` |
| [Scale and theme types](ref/scales.md) | `GanttScaleKey`, `GanttScaleFormat`, `GanttFormatOverrides`, `GanttTheme` |
| [scheduleTasks](ref/core-scheduling.md) | `scheduleTasks`, `SchedulingPolicy`, `ScheduleOptions`, `ScheduleResult` |
| [Task graph helpers](ref/core-graph.md) | `buildTaskGraph`, `canLink`, `findPath`, `linkKey`, `TaskGraph` |
| [Tree helpers](ref/core-tree.md) | `buildTaskTree`, `collectSubtreeIds`, `rollUpTasks`, `TaskTree` |
| [Critical path](ref/core-critical-path.md) | `computeCriticalPath`, `forwardPass`, `backwardPass` |
| [Working calendar](ref/core-calendar.md) | `createWorkingCalendar`, `CALENDAR_DAYS`, `WorkingCalendar` |

한국어 문서는 [../ko/](../ko/)에 있어요.
