import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttScaleKey,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface GanttState {
  rawTasks: Task[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  currentTask: TaskTransformed | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];

  // 액션
  setSelectedScale: (scale: GanttScaleKey) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  setDragOffset: (id: string, offset: GanttDragOffset) => void;
  clearDragOffset: (id: string) => void;
  clearAllDragOffsets: () => void;

  // 계산된 셀렉터
  getCurrentDragOffset: (taskId: string) => GanttDragOffset | null;
  getTotalWidth: () => number;
}

export const useGanttStore = create<GanttState>()(
  persist(
    (set, get) => ({
      rawTasks: [],
      transformedTasks: [],
      bottomRowCells: [],
      selectedScale: "month",
      currentTask: null,
      dragOffsets: {},

      setCurrentTask: (task) => set({ currentTask: task }),
      setSelectedScale: (scale) => set({ selectedScale: scale }),
      setRawTasks: (raw) => set({ rawTasks: raw }),
      setBottomRowCells: (cells) => set({ bottomRowCells: cells }),
      setTransformedTasks: (tasks) => set({ transformedTasks: tasks }),

      setDragOffset: (id, offset) =>
        set((state) => ({
          dragOffsets: { ...state.dragOffsets, [id]: offset },
        })),

      clearDragOffset: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.dragOffsets;
          return { dragOffsets: rest };
        }),

      // 진행 중인 드래그의 오프셋은 남긴다 - 드롭 직후 곧바로 시작된 드래그가
      // 타임라인 재계산에 휩쓸려 사라지지 않도록
      clearAllDragOffsets: () =>
        set((state) => {
          const activeId = state.currentTask?.id;
          const keys = Object.keys(state.dragOffsets);
          if (!keys.length) return state;
          if (!activeId || !state.dragOffsets[activeId]) {
            return { dragOffsets: {} };
          }
          if (keys.length === 1) return state;
          return { dragOffsets: { [activeId]: state.dragOffsets[activeId] } };
        }),

      getCurrentDragOffset: (taskId: string) => {
        const state = get();
        return state.dragOffsets[taskId] || null;
      },

      getTotalWidth: () => {
        const state = get();
        return state.bottomRowCells.reduce((sum, cell) => sum + cell.widthPx, 0);
      },
    }),
    {
      name: "gantt-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ selectedScale: state.selectedScale }),
    }
  )
);
