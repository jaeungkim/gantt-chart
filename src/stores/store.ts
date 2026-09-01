import { GANTT_SCALE_CONFIG } from "constants/gantt";
import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttLocaleOptions,
  GanttScaleKey,
} from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import { LinkAnchor, LinkRejection } from "utils/dependency";
import { createMutationGate, MutationGate } from "utils/mutation";
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

/**
 * Live state of a dependency drag
 *
 * Coordinates are px in the timeline content's space (the same one bars are positioned
 * in), so the preview line can be drawn straight into the arrow SVG.
 */
export interface GanttLinkDraft {
  /** Task the drag started on - it becomes the predecessor */
  fromTaskId: string;
  fromAnchor: LinkAnchor;
  fromX: number;
  fromY: number;
  /** Current pointer position */
  toX: number;
  toY: number;
  /** Task under the pointer, null over empty space */
  hoverTaskId: string | null;
  hoverAnchor: LinkAnchor | null;
  /** Why the hovered task cannot be linked - null when the drop would be accepted */
  rejection: LinkRejection | null;
}

/** Identifies one dependency: the successor that owns it and the predecessor it points at */
export interface GanttDependencyRef {
  sourceId: string;
  targetId: string;
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
  /** Dependency drag in progress - null when none is running */
  linkDraft: GanttLinkDraft | null;
  /** Arrow the user clicked, so Delete knows what to remove */
  selectedDependency: GanttDependencyRef | null;
  /** The selected row, or null - drives the highlight on the bar and on its grid row */
  selectedTaskId: string | null;
  /** Ids whose bar is animating back after a vetoed change */
  revertingIds: string[];
  /** Guards before-change handlers that are still in flight (created once, never replaced) */
  mutationGate: MutationGate;

  // Actions
  setSelectedScale: (scale: GanttScaleKey) => void;
  setExportMode: (exportMode: boolean) => void;
  setLocaleOptions: (options: GanttLocaleOptions | undefined) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  beginRevert: (ids: string[]) => void;
  endRevert: (ids: string[]) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  /** Update several tasks' offsets at once - dragging a summary bar moves its whole subtree */
  setDragOffsets: (offsets: Record<string, GanttDragOffset>) => void;
  clearDragOffsets: (ids: string[]) => void;
  clearAllDragOffsets: () => void;
  setLinkDraft: (draft: GanttLinkDraft | null) => void;
  setSelectedDependency: (dependency: GanttDependencyRef | null) => void;

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
    linkDraft: null,
    selectedDependency: null,
    selectedTaskId: null,
    revertingIds: [],
    mutationGate: createMutationGate(),

    setCurrentTask: (task) => set({ currentTask: task }),

    setExportMode: (exportMode) => set({ exportMode }),

    setLinkDraft: (draft) => set({ linkDraft: draft }),

    setSelectedDependency: (dependency) =>
      set((state) =>
        state.selectedDependency?.sourceId === dependency?.sourceId &&
        state.selectedDependency?.targetId === dependency?.targetId
          ? state
          : { selectedDependency: dependency }
      ),

    setLocaleOptions: (options) => set({ localeOptions: options }),

    setSelectedTaskId: (taskId) => {
      if (get().selectedTaskId === taskId) return;
      set({ selectedTaskId: taskId });
    },

    beginRevert: (ids) =>
      set((state) => {
        const next = ids.filter((id) => !state.revertingIds.includes(id));
        return next.length
          ? { revertingIds: [...state.revertingIds, ...next] }
          : state;
      }),

    endRevert: (ids) =>
      set((state) => {
        const remove = new Set(ids);
        const next = state.revertingIds.filter((id) => !remove.has(id));
        return next.length === state.revertingIds.length
          ? state
          : { revertingIds: next };
      }),

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
