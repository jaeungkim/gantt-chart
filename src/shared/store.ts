import {
  GanttBottomRowCell,
  GanttDragOffset,
  GanttLocaleOptions,
  GanttScaleKey,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import { GanttDropMode, GanttMoveRejection, GanttTaskMove } from "core/reorder";
import { LinkAnchor, LinkRejection } from "dependencies/utils/link";
import { createStore } from "zustand";

// Live state of a dependency drag - pointer px is in the timeline content's space
interface GanttLinkDraft {
  /** Task the drag started on - it becomes the predecessor */
  fromTaskId: string;
  fromAnchor: LinkAnchor;
  /** Current pointer position */
  toX: number;
  toY: number;
  /** Task under the pointer, null over empty space */
  hoverTaskId: string | null;
  hoverAnchor: LinkAnchor | null;
  /** Why the hovered task cannot be linked - null when the drop would be accepted */
  rejection: LinkRejection | null;
}

// Live state of a row drag - the indicator anchors to a row, not px, so a reflow cannot strand it
export interface GanttReorderDraft {
  /** Row being dragged */
  taskId: string;
  /** Row the indicator attaches to - an index into the rendered rows */
  rowIndex: number;
  /** Where the drop lands relative to that row */
  mode: GanttDropMode;
  /** Indent the indicator is drawn at, in tree levels */
  depth: number;
  /** The move this drop would commit - null when there is nothing valid under the pointer */
  move: GanttTaskMove | null;
  /** Why the drop is refused - null when it would be accepted */
  rejection: GanttMoveRejection | null;
}

/** Identifies one dependency: the successor that owns it and the predecessor it points at */
interface GanttDependencyRef {
  sourceId: string;
  targetId: string;
}

export interface GanttState {
  rawTasks: Task[];
  // Every rendered row's task, flattened, `order` rewritten to its row number - culled rows included.
  rowTasks: TaskTransformed[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  currentTask: TaskTransformed | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];
  /** Locale and label formats - undefined means the built-in English labels */
  localeOptions: GanttLocaleOptions | undefined;
  /** Dependency drag in progress - null when none is running */
  linkDraft: GanttLinkDraft | null;
  /** Row drag in progress - null when none is running */
  reorderDraft: GanttReorderDraft | null;
  /** Arrow the user clicked, so Delete knows what to remove */
  selectedDependency: GanttDependencyRef | null;
  /** The selected row, or null - drives the highlight on the bar and on its grid row */
  selectedTaskId: string | null;
  // Bar under the pointer, set on contact - lives in the store because the sibling arrow layer reads it.
  hoveredTaskId: string | null;

  setSelectedScale: (scale: GanttScaleKey) => void;
  setLocaleOptions: (options: GanttLocaleOptions | undefined) => void;
  setCurrentTask: (task: TaskTransformed | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setHoveredTaskId: (taskId: string | null) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  /** Applies the `tasks` prop - an echo of what the chart just wrote is ignored */
  syncTasksFromProps: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  setRowTasks: (tasks: TaskTransformed[]) => void;
  /** Update several tasks' offsets at once - dragging a summary bar moves its whole subtree */
  setDragOffsets: (offsets: Record<string, GanttDragOffset>) => void;
  clearDragOffsets: (ids: string[]) => void;
  clearAllDragOffsets: () => void;
  setLinkDraft: (draft: GanttLinkDraft | null) => void;
  setReorderDraft: (draft: GanttReorderDraft | null) => void;
  setSelectedDependency: (dependency: GanttDependencyRef | null) => void;

  getTotalWidth: () => number;
}

export type GanttStoreApi = ReturnType<typeof createGanttStore>;

// One store per Gantt instance - a module singleton would make two charts share task and drag state.
export function createGanttStore(initialScale: GanttScaleKey = "month") {
  return createStore<GanttState>()((set, get) => ({
    rawTasks: [],
    transformedTasks: [],
    rowTasks: [],
    bottomRowCells: [],
    selectedScale: initialScale,
    currentTask: null,
    dragOffsets: {},
    localeOptions: undefined,
    linkDraft: null,
    reorderDraft: null,
    selectedDependency: null,
    selectedTaskId: null,
    hoveredTaskId: null,

    setCurrentTask: (task) => set({ currentTask: task }),

    setLinkDraft: (draft) => set({ linkDraft: draft }),

    setReorderDraft: (draft) => set({ reorderDraft: draft }),

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

    // Guarded: without it a pointer moving inside one bar re-renders the arrow layer every event
    setHoveredTaskId: (taskId) => {
      if (get().hoveredTaskId === taskId) return;
      set({ hoveredTaskId: taskId });
    },

    setSelectedScale: (scale) => {
      if (get().selectedScale === scale) return;
      set({ selectedScale: scale });
    },

    setRawTasks: (raw) => set({ rawTasks: raw }),

    syncTasksFromProps: (raw) =>
      set((state) =>
        JSON.stringify(state.rawTasks) === JSON.stringify(raw)
          ? state
          : { rawTasks: raw }
      ),

    setBottomRowCells: (cells) => set({ bottomRowCells: cells }),
    setTransformedTasks: (tasks) => set({ transformedTasks: tasks }),
    setRowTasks: (tasks) => set({ rowTasks: tasks }),

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

    // Keeps an in-progress drag's offset, so a drag started right after a drop is not swept away.
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

    getTotalWidth: () => {
      const state = get();
      return state.bottomRowCells.reduce((sum, cell) => sum + cell.widthPx, 0);
    },
  }));
}
