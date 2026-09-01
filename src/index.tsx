// Styles
import './assets/styles/gantt.css';

// Main component
export { default as ReactGanttChart } from './pages/Gantt';

// Type exports
export type { GanttProps } from './pages/Gantt';
export type {
  GanttHandle,
  GanttScrollApi,
  GanttScrollOptions,
} from './hooks/useGanttScrollApi';
export type { GanttExportApi } from './hooks/useGanttExportApi';
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
export type {
  GanttColumn,
  GanttFormatOverrides,
  GanttScaleFormat,
  GanttScaleKey,
  GanttTheme,
} from './types/gantt';
