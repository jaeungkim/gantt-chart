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

export interface GanttLinkDraft {
  fromTaskId: string;
  fromAnchor: LinkAnchor;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hoverTaskId: string | null;
  hoverAnchor: LinkAnchor | null;
  rejection: LinkRejection | null;
}

export interface GanttReorderDraft {
  taskId: string;
  rowIndex: number;
  mode: GanttDropMode;
  depth: number;
  move: GanttTaskMove | null;
  rejection: GanttMoveRejection | null;
}

interface GanttDependencyRef {
  sourceId: string;
  targetId: string;
}

export interface GanttState {
  rawTasks: Task[];
  rowTasks: TaskTransformed[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  barDrag: { task: TaskTransformed; mode: GanttDragMode } | null;
  dragOffsets: Record<string, GanttDragOffset>;
  transformedTasks: TaskTransformed[];
  linkDraft: GanttLinkDraft | null;
  reorderDraft: GanttReorderDraft | null;
  selectedDependency: GanttDependencyRef | null;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;

  setSelectedScale: (scale: GanttScaleKey) => void;
  setBarDrag: (barDrag: GanttState["barDrag"]) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setHoveredTaskId: (taskId: string | null) => void;
  setRawTasks: (rawTasks: Task[]) => void;
  syncTasksFromProps: (rawTasks: Task[]) => void;
  setBottomRowCells: (cells: GanttBottomRowCell[]) => void;
  setTransformedTasks: (tasks: TaskTransformed[]) => void;
  setRowTasks: (tasks: TaskTransformed[]) => void;
  setDragOffsets: (offsets: Record<string, GanttDragOffset>) => void;
  clearDragOffsets: (ids: string[]) => void;
  clearAllDragOffsets: () => void;
  setLinkDraft: (draft: GanttLinkDraft | null) => void;
  setReorderDraft: (draft: GanttReorderDraft | null) => void;
  setSelectedDependency: (dependency: GanttDependencyRef | null) => void;
}

export type GanttStoreApi = ReturnType<typeof createGanttStore>;

export function snapshotTasks(tasks: Task[]): string | symbol {
  try {
    return JSON.stringify(tasks);
  } catch {
    return Symbol();
  }
}

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

    clearAllDragOffsets: () =>
      set((state) => {
        const keys = Object.keys(state.dragOffsets);
        if (!keys.length) return state;
        const task = state.barDrag?.task;
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
