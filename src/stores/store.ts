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
  bottomRowCells: GanttBottomRowCell[];
  topHeaderGroups: GanttTopHeaderGroup[];
  selectedScale: GanttScaleKey;
  currentTask: TaskTransformed | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTopHeaderGroups: (groups: GanttTopHeaderGroup[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  setDragOffset: (id: string, offset: GanttDragOffset) => void;
  clearDragOffset: (id: string) => void;
  
  // Computed selectors (to avoid re-renders)
  getCurrentDragOffset: (taskId: string) => GanttDragOffset | null;
  getTotalWidth: () => number;
}

export const useGanttStore = create<GanttState>()(
  persist(
    (set, get) => {
      return {
        rawTasks: [],
        transformedTasks: [],
        bottomRowCells: [],
        topHeaderGroups: [],
        selectedScale: 'month',
        currentTask: null,
        dragOffsets: {},

        setCurrentTask: (task) => set({ currentTask: task }),
        setSelectedScale: (scale) => set({ selectedScale: scale }),
        setRawTasks: (raw) => set({ rawTasks: raw }),
        setBottomRowCells: (cells) => set({ bottomRowCells: cells }),
        setTopHeaderGroups: (groups) => set({ topHeaderGroups: groups }),
        setTransformedTasks: (tasks) => set({ transformedTasks: tasks }),

        setDragOffset: (id, offset) =>
          set((state) => ({
            dragOffsets: { ...state.dragOffsets, [id]: offset }
          })),

        clearDragOffset: (id) =>
          set((state) => {
            const { [id]: _removed, ...rest } = state.dragOffsets;
            return { dragOffsets: rest };
          }),

        // Computed selectors to avoid unnecessary re-renders
        getCurrentDragOffset: (taskId: string) => {
          const state = get();
          return state.dragOffsets[taskId] || null;
        },

        getTotalWidth: () => {
          const state = get();
          return state.bottomRowCells.reduce((sum, cell) => sum + cell.widthPx, 0);
        },
      };
    },
    {
      name: 'gantt-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selectedScale: state.selectedScale }),
    },
  ),
);