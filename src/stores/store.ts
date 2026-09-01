import { GANTT_SCALE_CONFIG } from "constants/gantt";
import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttLocaleOptions,
  GanttScaleKey,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import {
  applyPatches,
  DEFAULT_HISTORY_LIMIT,
  diffTasks,
  EMPTY_HISTORY,
  HistoryStack,
  limitHistory,
  popRedo,
  popUndo,
  pushHistory,
} from "utils/history";
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
  /** Undo/redo steps, one entry per completed gesture */
  history: HistoryStack;
  /** How many undo steps are kept */
  historyLimit: number;

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setExportMode: (exportMode: boolean) => void;
  setLocaleOptions: (options: GanttLocaleOptions | undefined) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  /**
   * Replaces the task data without touching the history
   *
   * A user gesture must go through `commitTasks` instead, or it will not be undoable.
   */
  setRawTasks: (rawTasks: Task[]) => void;
  /**
   * Commits the result of one gesture and records a single undo step for it,
   * however many tasks it touched
   */
  commitTasks: (rawTasks: Task[]) => void;
  /** Applies the `tasks` prop - a genuine change clears the history, an echo is ignored */
  syncTasksFromProps: (rawTasks: Task[]) => void;
  setHistoryLimit: (limit: number) => void;
  /** Reverts the newest step and returns the resulting tasks, or null when there is none */
  undo: () => Task[] | null;
  /** Replays the newest undone step and returns the resulting tasks, or null when there is none */
  redo: () => Task[] | null;
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
    history: EMPTY_HISTORY,
    historyLimit: DEFAULT_HISTORY_LIMIT,

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

    // One call per gesture, so one undo step per gesture - a subtree drag that moved
    // 20 rows commits once and undoes in one press
    commitTasks: (raw) =>
      set((state) => {
        const entry = diffTasks(state.rawTasks, raw);
        return {
          rawTasks: raw,
          // A change no field patch can invert (rows added or removed) would replay
          // into corrupt data - drop the history rather than store it
          history: entry
            ? pushHistory(state.history, entry, state.historyLimit)
            : EMPTY_HISTORY,
        };
      }),

    // The host owns the data, so data it hands in that the chart does not already have
    // supersedes everything the user did - the steps recorded against the old data no
    // longer describe these rows. An echo of what the chart just committed is not that,
    // and leaves the history alone.
    syncTasksFromProps: (raw) =>
      set((state) =>
        JSON.stringify(state.rawTasks) === JSON.stringify(raw)
          ? state
          : { rawTasks: raw, history: EMPTY_HISTORY }
      ),

    setHistoryLimit: (limit) =>
      set((state) =>
        state.historyLimit === limit
          ? state
          : { historyLimit: limit, history: limitHistory(state.history, limit) }
      ),

    undo: () => {
      const state = get();
      const popped = popUndo(state.history);
      if (!popped) return null;

      const rawTasks = applyPatches(state.rawTasks, popped.entry, "before");
      set({ rawTasks, history: popped.stack });
      return rawTasks;
    },

    redo: () => {
      const state = get();
      const popped = popRedo(state.history);
      if (!popped) return null;

      const rawTasks = applyPatches(state.rawTasks, popped.entry, "after");
      set({ rawTasks, history: popped.stack });
      return rawTasks;
    },

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
