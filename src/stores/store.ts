import { GANTT_SCALE_CONFIG } from "constants/gantt";
import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttScaleKey,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { create } from "zustand";

/** 스케일 선택을 세션에 보존하는 키 */
const SCALE_STORAGE_KEY = "gantt-scale";

/**
 * 세션에 저장된 스케일을 읽는다 - 저장값이 없거나 세션 저장소에 접근할 수 없으면 null
 *
 * 모듈 로드 시점이 아니라 마운트 이후에만 호출해야 한다.
 * (SSR에서 import만으로 sessionStorage를 건드리지 않게, 그리고 첫 렌더를
 *  서버와 동일하게 유지해 하이드레이션 불일치를 만들지 않게)
 */
export function readPersistedScale(): GanttScaleKey | null {
  try {
    const stored = sessionStorage.getItem(SCALE_STORAGE_KEY);
    return stored && stored in GANTT_SCALE_CONFIG
      ? (stored as GanttScaleKey)
      : null;
  } catch {
    // SSR/프라이빗 모드 등 세션 저장소를 쓸 수 없는 환경
    return null;
  }
}

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

export const useGanttStore = create<GanttState>()((set, get) => ({
  rawTasks: [],
  transformedTasks: [],
  bottomRowCells: [],
  selectedScale: "month",
  currentTask: null,
  dragOffsets: {},

  setCurrentTask: (task) => set({ currentTask: task }),

  // 세션 저장은 여기서만 - persist 미들웨어를 쓰면 드래그 프레임마다 스토어가
  // 갱신될 때도 sessionStorage에 동기 쓰기가 발생한다
  setSelectedScale: (scale) => {
    if (get().selectedScale === scale) return;
    set({ selectedScale: scale });
    try {
      sessionStorage.setItem(SCALE_STORAGE_KEY, scale);
    } catch {
      // 세션 저장소를 쓸 수 없는 환경 - 저장만 건너뛴다
    }
  },

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
}));
