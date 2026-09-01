import { GANTT_SCALE_CONFIG } from "constants/gantt";
import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttLocaleOptions,
  GanttScaleKey,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { createStore } from "zustand";

/** Default key the scale selection is persisted under for the session */
export const DEFAULT_SCALE_STORAGE_KEY = "gantt-scale";

/**
 * Reads the scale saved for the session - null when nothing is stored or session
 * storage cannot be reached
 *
 * Must be called only after mount, never at module load time.
 * (So a bare import does not touch sessionStorage under SSR, and so the first render
 *  matches the server's and creates no hydration mismatch)
 */
export function readPersistedScale(
  storageKey: string = DEFAULT_SCALE_STORAGE_KEY
): GanttScaleKey | null {
  try {
    const stored = sessionStorage.getItem(storageKey);
    return stored && stored in GANTT_SCALE_CONFIG
      ? (stored as GanttScaleKey)
      : null;
  } catch {
    // Environments where session storage is unusable - SSR, private mode, and so on
    return null;
  }
}

export interface GanttState {
  rawTasks: Task[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  currentTask: TaskTransformed | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];
  /**
   * While true, virtualization is bypassed and every row, bar, arrow and header
   * cell is rendered at once.
   *
   * Only `exportToPng` turns this on, for the frames it takes to capture the
   * chart - a capture of the virtualized DOM would be a picture of the visible
   * slice with blank space around it.
   */
  exportMode: boolean;
  /** Locale and label formats - undefined means the built-in English labels */
  localeOptions: GanttLocaleOptions | undefined;

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setExportMode: (exportMode: boolean) => void;
  setLocaleOptions: (options: GanttLocaleOptions | undefined) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  /** Update several tasks' offsets at once - dragging a summary bar moves its whole subtree */
  setDragOffsets: (offsets: Record<string, GanttDragOffset>) => void;
  clearDragOffsets: (ids: string[]) => void;
  clearAllDragOffsets: () => void;

  // Computed selectors
  getCurrentDragOffset: (taskId: string) => GanttDragOffset | null;
  getTotalWidth: () => number;
}

export type GanttStoreApi = ReturnType<typeof createGanttStore>;

/**
 * Creates one store per Gantt instance.
 *
 * With a module-scope singleton, two charts on one page would share task, scale
 * and drag state and overwrite each other.
 */
export function createGanttStore(
  storageKey: string = DEFAULT_SCALE_STORAGE_KEY
) {
  return createStore<GanttState>()((set, get) => ({
    rawTasks: [],
    transformedTasks: [],
    bottomRowCells: [],
    selectedScale: "month",
    currentTask: null,
    dragOffsets: {},
    exportMode: false,
    localeOptions: undefined,

    setCurrentTask: (task) => set({ currentTask: task }),

    setExportMode: (exportMode) => set({ exportMode }),

    setLocaleOptions: (options) => set({ localeOptions: options }),

    // Session persistence happens only here - with the persist middleware, every store
    // update would write to sessionStorage synchronously, drag frames included
    setSelectedScale: (scale) => {
      if (get().selectedScale === scale) return;
      set({ selectedScale: scale });
      try {
        sessionStorage.setItem(storageKey, scale);
      } catch {
        // Session storage is unusable - only the persisting is skipped
      }
    },

    setRawTasks: (raw) => set({ rawTasks: raw }),
    setBottomRowCells: (cells) => set({ bottomRowCells: cells }),
    setTransformedTasks: (tasks) => set({ transformedTasks: tasks }),

    // Runs every drag frame - one store update even when a whole subtree moves
    setDragOffsets: (offsets) =>
      set((state) => ({
        dragOffsets: { ...state.dragOffsets, ...offsets },
      })),

    clearDragOffsets: (ids) =>
      set((state) => {
        const rest = { ...state.dragOffsets };
        let removed = false;
        for (const id of ids) {
          if (id in rest) {
            delete rest[id];
            removed = true;
          }
        }
        return removed ? { dragOffsets: rest } : state;
      }),

    // Keep the offset of a drag that is still in progress - so a drag started right
    // after a drop is not swept away by the timeline recomputation
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
}
