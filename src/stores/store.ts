import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import { transformTasks } from 'utils/transformData';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GanttState {
  rawTasks: Task[];
  transformedTasks: TaskTransformed[];

  // Timeline rows
  bottomRowCells: GanttBottomRowCell[];
  topHeaderGroups: GanttTopHeaderGroup[];

  selectedScale: GanttScaleKey;
  draggingTaskMeta: { taskId: string; type: 'bar' | 'left' | 'right' } | null;
  draggingBarDateRange: {
    startDate: string;
    endDate: string;
    barLeft: number;
    barWidth: number;
  };

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTopHeaderGroups: (groups: GanttTopHeaderGroup[]) => void;
  setDraggingTaskMeta: (meta: GanttState['draggingTaskMeta']) => void;
  setDraggingBarDateRange: (range: {
    startDate: string;
    endDate: string;
    barLeft: number;
    barWidth: number;
  }) => void;
  clearDraggingTaskMeta: () => void;
  clearDraggingBarDateRange: () => void;
}

export const useGanttStore = create<GanttState>()(
  persist(
    (set, get) => ({
      rawTasks: [],
      transformedTasks: [],
      bottomRowCells: [],
      topHeaderGroups: [],
      selectedScale: 'month',
      draggingBarDateRange: {
        startDate: '',
        endDate: '',
        barLeft: 0,
        barWidth: 0,
      },
      draggingTaskMeta: null,

      setSelectedScale: (scale) => {
        const { rawTasks, bottomRowCells } = get();
        const transformed = transformTasks(rawTasks, bottomRowCells, scale);
        set({ selectedScale: scale, transformedTasks: transformed });
      },

      setDraggingBarDateRange: (range) => {
        set({ draggingBarDateRange: range });
      },
      setRawTasks: (rawTasks) => {
        const { bottomRowCells, selectedScale } = get();
        const transformed = transformTasks(
          rawTasks,
          bottomRowCells,
          selectedScale,
        );
        set({ rawTasks, transformedTasks: transformed });
      },

      setBottomRowCells: (cells) => {
        const { rawTasks, selectedScale } = get();
        const transformed = transformTasks(rawTasks, cells, selectedScale);
        set({ bottomRowCells: cells, transformedTasks: transformed });
      },

      setTopHeaderGroups: (groups) => set({ topHeaderGroups: groups }),

      setDraggingTaskMeta: (meta) => set({ draggingTaskMeta: meta }),
      clearDraggingTaskMeta: () => set({ draggingTaskMeta: null }),

      clearDraggingBarDateRange: () =>
        set({
          draggingBarDateRange: {
            startDate: '',
            endDate: '',
            barLeft: 0,
            barWidth: 0,
          },
        }),
    }),
    {
      name: 'gantt-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selectedScale: state.selectedScale }),
    },
  ),
);
