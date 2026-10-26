import {
  GanttBottomRowCell,
  GanttDragMode,
  GanttDragOffset,
  GanttScaleKey,
  LinkAnchor,
  LinkRejection,
} from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import { GanttDropMode, GanttMoveRejection, GanttTaskMove } from "core/reorder";
import { collectSubtreeIds } from "core/tree";
import { GANTT_SCALE_CONFIG } from "shared/constants";
import { createStore } from "zustand";

// Live state of a dependency drag - pointer px is in the timeline content's space
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
  /** The move this drop would commit */
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
  /** The running bar drag and which gesture it is - null when none */
  barDrag: { task: TaskTransformed; mode: GanttDragMode } | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];
  /** Dependency drag in progress - null when none is running */
  linkDraft: GanttLinkDraft | null;
  /** Row drag in progress - null when none is running */
  reorderDraft: GanttReorderDraft | null;
  /** Arrow the user clicked, so the link menu's delete knows what to remove */
  selectedDependency: GanttDependencyRef | null;
  /** The selected row, or null - drives the highlight on the bar and on its grid row */
  selectedTaskId: string | null;
  // Bar under the pointer, set on contact - lives in the store because the sibling arrow layer reads it.
  hoveredTaskId: string | null;

  setSelectedScale: (scale: GanttScaleKey) => void;
  setBarDrag: (barDrag: GanttState["barDrag"]) => void;
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
}

export type GanttStoreApi = ReturnType<typeof createGanttStore>;

// Content key for the tasks prop. A list that cannot be serialized (a cycle, a BigInt) gets a
// fresh symbol, which equals nothing, so it always counts as changed instead of throwing.
export function snapshotTasks(tasks: Task[]): string | symbol {
  try {
    return JSON.stringify(tasks);
  } catch {
    return Symbol();
  }
}

// One store per Gantt instance - a module singleton would make two charts share task and drag state.
export function createGanttStore(initialScale: GanttScaleKey = "month") {
  return createStore<GanttState>()((set, get) => ({
    rawTasks: [],
    transformedTasks: [],
    rowTasks: [],
    bottomRowCells: [],
    selectedScale: Object.prototype.hasOwnProperty.call(
      GANTT_SCALE_CONFIG,
      initialScale
    )
      ? initialScale
      : "month",
    barDrag: null,
    dragOffsets: {},
    linkDraft: null,
    reorderDraft: null,
    selectedDependency: null,
    selectedTaskId: null,
    hoveredTaskId: null,

    setBarDrag: (barDrag) => set({ barDrag }),

    setLinkDraft: (draft) => set({ linkDraft: draft }),

    setReorderDraft: (draft) => set({ reorderDraft: draft }),

    setSelectedDependency: (dependency) =>
      set((state) =>
        state.selectedDependency?.sourceId === dependency?.sourceId &&
        state.selectedDependency?.targetId === dependency?.targetId
          ? state
          : { selectedDependency: dependency }
      ),

    setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

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
        snapshotTasks(state.rawTasks) === snapshotTasks(raw)
          ? state
          : { rawTasks: raw }
      ),

    setBottomRowCells: (cells) => set({ bottomRowCells: cells }),
    setTransformedTasks: (tasks) => set({ transformedTasks: tasks }),
    setRowTasks: (tasks) => set({ rowTasks: tasks }),

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

    // Keeps an in-progress drag's offsets, so a drag started right after a drop is not swept away.
    clearAllDragOffsets: () =>
      set((state) => {
        const keys = Object.keys(state.dragOffsets);
        if (!keys.length) return state;
        const task = state.barDrag?.task;
        // the in-flight drag's members, picked as useGanttBarDrag does: a summary moves its subtree
        const liveIds = !task
          ? []
          : task.isSummary
            ? collectSubtreeIds(state.rawTasks, task.id)
            : [task.id];
        const kept: Record<string, GanttDragOffset> = {};
        for (const id of liveIds) {
          if (state.dragOffsets[id]) kept[id] = state.dragOffsets[id];
        }
        return Object.keys(kept).length === keys.length ? state : { dragOffsets: kept };
      }),
  }));
}
