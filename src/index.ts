import './styles.css';

export { default as ReactGanttChart } from './Gantt';

export type {
  GanttDetailApi,
  GanttHandle,
  GanttProps,
  GanttTaskCreateApi,
} from './props';
export type { GanttScrollApi, GanttScrollOptions } from './features/timeline/types';

export type { DependencyType, Task, TaskDependency } from './core/types';
export type { GanttInteractionConfig, TaskTransformed } from './shared/task';

export type {
  GanttDateRange,
  GanttDetailRenderProps,
  GanttDetailRenderer,
  GanttFormatOverrides,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
  Holiday,
} from './shared/types';
export type { GanttDependencyChange } from './features/dependencies/types';
export type { GanttTaskDraft } from './features/bars/types';
export type { GanttRow } from './features/rows/utils/rows';

// Headless core - no React, no DOM. Usable on a server or in a worker.
export {
  CALENDAR_DAYS,
  createWorkingCalendar,
  type WorkingCalendar,
  type WorkingCalendarOptions,
} from './core/calendar';
export {
  buildTaskTree,
  collectSubtreeIds,
  rollUpTasks,
  type TaskTree,
} from './core/tree';
export {
  moveTask,
  sortTasksBySequence,
  validateMove,
  type GanttMoveOptions,
  type GanttMoveRejection,
  type GanttTaskMove,
  type GanttTaskMoveChange,
} from './core/reorder';
