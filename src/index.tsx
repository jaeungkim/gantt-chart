// Styles
import './assets/styles/gantt.css';

// Main component
export { default as ReactGanttChart } from './components/Gantt/Gantt';

// Type exports
export type { GanttProps } from './components/Gantt/GanttProps';
export type {
  GanttHandle,
  GanttScrollApi,
  GanttScrollOptions,
  GanttZoomAnchor,
} from './hooks/useGanttScrollApi';
export type { GanttExportApi } from './hooks/useGanttExportApi';
export type { GanttHistoryApi } from './hooks/useGanttHistoryApi';
export type {
  GanttExportOptions,
  GanttExportRange,
} from './utils/pngExport';
export type {
  Task,
  TaskDependency,
  DependencyType,
  TaskType,
  TaskTransformed,
  GanttInteractionConfig,
} from './types/task';
export type { GanttDependencyChange } from './hooks/useGanttLinkDrag';
export type { GanttTaskDraft } from './hooks/useGanttDrawCreate';
export type {
  GanttColumn,
  GanttDateRange,
  GanttFormatOverrides,
  GanttGroupBy,
  GanttMarker,
  GanttRangeBand,
  GanttReorderChange,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
  GanttChangeType,
  GanttTaskChange,
  GanttBeforeChangeHandler,
  GanttBarRenderProps,
  GanttBarRenderer,
  GanttTooltipReason,
  GanttTooltipRenderProps,
  GanttTooltipRenderer,
  GanttHeaderCellRenderProps,
  GanttHeaderCellRenderer,
} from './types/gantt';
export type { GanttRow, GanttRowGroup } from './utils/grouping';

// Headless scheduling core - no React, no DOM. Usable on a server or in a worker.
export {
  backwardPass,
  buildTaskGraph,
  buildTaskTree,
  CALENDAR_DAYS,
  canLink,
  collectSubtreeIds,
  computeCriticalPath,
  createWorkingCalendar,
  findPath,
  forwardPass,
  linkKey,
  rollUpTasks,
  scheduleTasks,
} from './core';
export type {
  CriticalPathResult,
  ScheduleOptions,
  ScheduleResult,
  SchedulingLink,
  SchedulingPolicy,
  TaskGraph,
  TaskScheduleMetrics,
  TaskTree,
  WorkingCalendar,
  WorkingCalendarOptions,
} from './core';
