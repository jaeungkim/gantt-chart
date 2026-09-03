// The headless core: plain data and pure functions only, no React/DOM/pixels.
// The boundary is enforced by an eslint rule in `eslint.config.js`.

export { default as dayjs } from './dates';

export type {
  DependencyType,
  Task,
  TaskDependency,
} from './types';
export { normalizeProgress } from './types';

export {
  CALENDAR_DAYS,
  createWorkingCalendar,
  type WorkingCalendar,
  type WorkingCalendarOptions,
} from './calendar';

export {
  buildTaskTree,
  collectSubtreeIds,
  getVisibleTasks,
  rollUpTasks,
  type TaskTree,
} from './tree';

export {
  moveTask,
  sortTasksBySequence,
  validateMove,
  type GanttMoveOptions,
  type GanttMoveRejection,
  type GanttTaskMove,
  type GanttTaskMoveChange,
} from './reorder';
