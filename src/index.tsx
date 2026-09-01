// Styles
import './assets/styles/gantt.css';

// Main component
export { default as ReactGanttChart } from './pages/Gantt';

// Type exports
export type { GanttProps } from './pages/Gantt';
export type {
  GanttHandle,
  GanttScrollOptions,
  GanttZoomAnchor,
} from './hooks/useGanttScrollApi';
export type {
  Task,
  TaskDependency,
  DependencyType,
  TaskType,
  TaskTransformed,
} from './types/task';
export type {
  GanttColumn,
  GanttDateRange,
  GanttFormatOverrides,
  GanttMarker,
  GanttRangeBand,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
} from './types/gantt';
