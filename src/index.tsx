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
  GanttInteractionConfig,
} from './types/task';
export type { GanttDependencyChange } from './hooks/useGanttLinkDrag';
export type { GanttTaskDraft } from './hooks/useGanttDrawCreate';
export type {
  GanttColumn,
  GanttFormatOverrides,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
} from './types/gantt';
