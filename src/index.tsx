// Styles
import './assets/styles/gantt.css';

// Main component
export { default as ReactGanttChart } from './pages/Gantt';

// Type exports
export type { GanttProps } from './pages/Gantt';
export type {
  GanttHandle,
  GanttScrollOptions,
} from './hooks/useGanttScrollApi';
export type {
  Task,
  TaskDependency,
  DependencyType,
  TaskType,
  TaskTransformed,
} from './types/task';
export type { GanttColumn, GanttScaleKey, GanttTheme } from './types/gantt';

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
