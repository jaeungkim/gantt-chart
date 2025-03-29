import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { transformTasks } from 'utils/transformData';
import { create } from 'zustand';

interface GanttState {
  rawTasks: Task[];
  transformedTasks: TaskTransformed[];

  // Timeline rows
  bottomRowCells: GanttBottomRowCell[];
  topHeaderGroups: GanttTopHeaderGroup[];

  selectedScale: GanttScaleKey;
  minDate: dayjs.Dayjs;
  maxDate: dayjs.Dayjs;

  draggingTaskMeta: { taskId: string; type: 'bar' | 'left' | 'right' } | null;

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTopHeaderGroups: (groups: GanttTopHeaderGroup[]) => void;
  setMinDate: (date: dayjs.Dayjs) => void;
  setMaxDate: (date: dayjs.Dayjs) => void;
  setDraggingTaskMeta: (meta: GanttState['draggingTaskMeta']) => void;
  clearDraggingTaskMeta: () => void;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  rawTasks: [],
  transformedTasks: [],
  bottomRowCells: [],
  topHeaderGroups: [],
  selectedScale: 'month',
  minDate: dayjs(),
  maxDate: dayjs(),
  draggingTaskMeta: null,

  setSelectedScale: (scale) => {
    const { rawTasks, bottomRowCells } = get();
    const transformed = transformTasks(rawTasks, bottomRowCells, scale);
    set({ selectedScale: scale, transformedTasks: transformed });
  },

  setRawTasks: (rawTasks) => {
    const { bottomRowCells, selectedScale } = get();
    const transformed = transformTasks(rawTasks, bottomRowCells, selectedScale);
    set({ rawTasks, transformedTasks: transformed });
  },

  setBottomRowCells: (cells) => {
    const { rawTasks, selectedScale } = get();
    const transformed = transformTasks(rawTasks, cells, selectedScale);
    set({ bottomRowCells: cells, transformedTasks: transformed });
  },

  setTopHeaderGroups: (groups) => set({ topHeaderGroups: groups }),

  setMinDate: (date) => set({ minDate: date }),
  setMaxDate: (date) => set({ maxDate: date }),

  setDraggingTaskMeta: (meta) => set({ draggingTaskMeta: meta }),
  clearDraggingTaskMeta: () => set({ draggingTaskMeta: null }),
}));
