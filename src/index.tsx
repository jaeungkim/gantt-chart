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
export type {
  GanttColumn,
  GanttFormatOverrides,
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
