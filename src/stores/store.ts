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

  // Timeline rows
  bottomRowCells: GanttBottomRowCell[];
  topHeaderGroups: GanttTopHeaderGroup[];
  selectedScale: GanttScaleKey;

  // Transformed tasks
  transformedTasks: TaskTransformed[]; // Adjust the type as needed

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTopHeaderGroups: (groups: GanttTopHeaderGroup[]) => void;
}

export const useGanttStore = create<GanttState>()(
  persist(
    (set, get) => {
      const recalc = (
        raw = get().rawTasks,
        cells = get().bottomRowCells,
        scale = get().selectedScale,
      ) => transformTasks(raw, cells, scale);

      return {
        rawTasks: [],
        transformedTasks: [],
        bottomRowCells: [],
        topHeaderGroups: [],
        selectedScale: 'month',

        setSelectedScale: (scale) =>
          set({
            selectedScale: scale,
            transformedTasks: recalc(undefined, undefined, scale),
          }),

        setRawTasks: (raw) =>
          set({
            rawTasks: raw,
            transformedTasks: recalc(raw),
          }),

        setBottomRowCells: (cells) =>
          set({
            bottomRowCells: cells,
            transformedTasks: recalc(undefined, cells),
          }),

        setTopHeaderGroups: (groups) => set({ topHeaderGroups: groups }),
      };
    },
    {
      name: 'gantt-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ selectedScale: s.selectedScale }),
    },
  ),
);
