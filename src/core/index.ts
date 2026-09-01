/**
 * The headless scheduling core.
 *
 * Everything under `src/core/` is plain data and pure functions - no React, no DOM, no
 * pixels - so it runs in Node, is unit-testable on its own, and could be published as a
 * separate entry point without dragging the renderer along. The boundary is enforced by an
 * eslint rule in `eslint.config.js`; keep anything that touches refs, elements or bar
 * geometry in `src/utils/` instead.
 */

export { default as dayjs } from './dates';

export type {
  DependencyType,
  Task,
  TaskDependency,
  TaskType,
} from './types';
export { isMilestoneTask, normalizeProgress } from './types';

export {
  CALENDAR_DAYS,
  createWorkingCalendar,
  type WorkingCalendar,
  type WorkingCalendarOptions,
} from './calendar';

export {
  buildTaskGraph,
  canLink,
  findPath,
  linkDelta,
  linkKey,
  scheduleTasks,
  shiftTask,
  taskEnd,
  taskStart,
  type ScheduleOptions,
  type ScheduleResult,
  type SchedulingLink,
  type SchedulingPolicy,
  type TaskGraph,
} from './scheduling';

export {
  backwardPass,
  computeCriticalPath,
  forwardPass,
  type CriticalPathOptions,
  type CriticalPathResult,
  type EarlyDates,
  type LateDates,
  type TaskScheduleMetrics,
} from './criticalPath';

export {
  buildTaskTree,
  collectSubtreeIds,
  getVisibleTasks,
  rollUpTasks,
  type TaskTree,
} from './tree';
