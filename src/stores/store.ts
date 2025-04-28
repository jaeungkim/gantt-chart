import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GanttState {
  rawTasks: Task[];

  // Timeline rows
  bottomRowCells: GanttBottomRowCell[];
  topHeaderGroups: GanttTopHeaderGroup[];
  selectedScale: GanttScaleKey;

  /* ⏱  LIVE drag offsets (keyed by taskId) */
  dragOffsets: Record<string, GanttDragOffset>;

  // Transformed tasks
  transformedTasks: TaskTransformed[];

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTopHeaderGroups: (groups: GanttTopHeaderGroup[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;

  setDragOffset: (id: string, o: GanttDragOffset) => void;
  clearDragOffset: (id: string) => void;
}

export const useGanttStore = create<GanttState>()(
  persist(
    (set) => {
      return {
        rawTasks: [],
        transformedTasks: [],
        bottomRowCells: [],
        topHeaderGroups: [],
        selectedScale: 'month',
        dragOffsets: {},

        setSelectedScale: (scale) =>
          set({
            selectedScale: scale,
          }),

        setRawTasks: (raw) =>
          set({
            rawTasks: raw,
          }),

        setBottomRowCells: (cells) =>
          set({
            bottomRowCells: cells,
          }),

        setTopHeaderGroups: (groups) => set({ topHeaderGroups: groups }),

        setTransformedTasks: (tasks) =>
          set({
            transformedTasks: tasks,
          }),

        setDragOffset: (id, offset) =>
          set((s) => ({ dragOffsets: { ...s.dragOffsets, [id]: offset } })),

        clearDragOffset: (id) =>
          set((s) => {
            const { [id]: _removed, ...rest } = s.dragOffsets;
            return { dragOffsets: rest };
          }),
      };
    },
    {
      name: 'gantt-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ selectedScale: s.selectedScale }),
    },
  ),
);
