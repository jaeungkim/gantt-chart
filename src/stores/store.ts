import { GanttTimelineGrid, GanttTimelineScale } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { transformTasks } from 'utils/transformData';
import { create } from 'zustand';

/**
 * We maintain:
 *  - rawTasks: Task[] as the source of truth for actual dates
 *  - tasks: TaskTransformed[] derived from rawTasks + timelineGrids
 *  - timelineGrids: timeline columns
 *  - selectedScale: e.g. 'monthly'
 *  - minDate, maxDate: for timeline boundaries
 */
interface GanttState {
  rawTasks: Task[];
  tasks: TaskTransformed[];
  timelineGrids: GanttTimelineGrid[];
  selectedScale: GanttTimelineScale;
  minDate: dayjs.Dayjs;
  maxDate: dayjs.Dayjs;

  // Actions
  setRawTasks: (rawTasks: Task[]) => void;
  setTimelineGrids: (grids: GanttTimelineGrid[]) => void;
  setMinDate: (date: dayjs.Dayjs) => void;
  setMaxDate: (date: dayjs.Dayjs) => void;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  rawTasks: [],
  tasks: [],
  timelineGrids: [],
  selectedScale: 'monthly',
  minDate: dayjs(),
  maxDate: dayjs(),

  /**
   * Update rawTasks & auto-transform
   */
  setRawTasks: (rawTasks) => {
    const { timelineGrids, selectedScale } = get();
    const transformed = transformTasks(rawTasks, timelineGrids, selectedScale);
    set({ rawTasks, tasks: transformed });
  },

  /**
   * Update timeline grid & auto-transform
   */
  setTimelineGrids: (grids) => {
    const { rawTasks, selectedScale } = get();
    const transformed = transformTasks(rawTasks, grids, selectedScale);
    set({ timelineGrids: grids, tasks: transformed });
  },

  /**
   * Update minDate
   */
  setMinDate: (date) => set({ minDate: date }),

  /**
   * Update maxDate
   */
  setMaxDate: (date) => set({ maxDate: date }),
}));
