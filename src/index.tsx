// 스타일
import './assets/styles/gantt.css';

// 메인 컴포넌트
export { default as ReactGanttChart } from './pages/Gantt';

// 타입 내보내기
export type { GanttProps } from './pages/Gantt';
export type { Task, TaskDependency, DependencyType } from './types/task';
export type { GanttScaleKey, GanttTheme } from './types/gantt';
