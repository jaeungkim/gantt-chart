import './styles.css';

export { default as ReactGanttChart } from './Gantt';

export type { GanttProps } from './props';
export type {
  GanttDetailApi,
  GanttHandle,
  GanttTaskCreateApi,
  GanttScrollApi,
  GanttScrollOptions,
  GanttZoomAnchor,
} from './timeline/hooks/useGanttScrollApi';
export type {
  Task,
  TaskDependency,
  DependencyType,
  TaskTransformed,
  GanttInteractionConfig,
} from './shared/task';
export type { GanttDependencyChange } from './dependencies/hooks/useGanttLinkDrag';
export type {
  GanttMoveRejection,
  GanttTaskMove,
  GanttTaskMoveChange,
} from './core/reorder';
export type { GanttTaskDraft } from './bars/hooks/useGanttDrawCreate';
export type {
  GanttDateRange,
  GanttDetailRenderProps,
  GanttDetailRenderer,
  GanttFormatOverrides,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
} from './shared/types';
export type { GanttRow } from './rows/utils/rows';

// Headless core - no React, no DOM. Usable on a server or in a worker.
export {
  buildTaskTree,
  CALENDAR_DAYS,
  collectSubtreeIds,
  createWorkingCalendar,
  moveTask,
  rollUpTasks,
  sortTasksBySequence,
  validateMove,
} from './core';
export type {
  GanttMoveOptions,
  TaskTree,
  WorkingCalendar,
  WorkingCalendarOptions,
} from './core';
