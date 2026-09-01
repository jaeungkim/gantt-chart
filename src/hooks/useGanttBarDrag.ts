import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
} from "constants/gantt";
import { Dayjs } from "dayjs";
import { useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "stores/context";
import { GanttDragOffset, GanttScaleKey } from "types/gantt";
import { isMilestoneTask, Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { shiftByDragSteps } from "utils/timeline";
import { collectSubtreeIds } from "utils/tree";

export type DragMode = "bar" | "left" | "right";

interface DragContext {
  mode: DragMode;
  pointerId: number;
  initialClientX: number;
  initialStartDate: Dayjs;
  initialEndDate: Dayjs;
  initialBarWidth: number;
  dragSteps: number;
  basePxPerDragStep: number;
  // Keep computing in the step unit from when the drag started, even if the scale changes mid-drag
  scaleKey: GanttScaleKey;
  taskId: string;
  /** Tasks that move together - the whole subtree for a summary row, otherwise just itself */
  taskIds: string[];
  /** Dates the moving tasks had when the drag started */
  initialDates: Map<string, { start: Dayjs; end: Dayjs }>;
}

/**
 * Hook providing the Gantt bar drag behavior
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const storeApi = useGanttStoreApi();
  const dragContextRef = useRef<DragContext | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const onTasksChangeRef = useRef(onTasksChange);
  onTasksChangeRef.current = onTasksChange;

  const selectedScale = useGanttStore((s) => s.selectedScale);
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];

  // Detect the drag mode
  // Milestones and narrow bars cannot be resized - keeps the edge zones from covering the
  // whole bar and blocking the move
  // Summary bars cannot be resized either - both ends come from the children, so a resize
  // would snap straight back
  const detectDragMode = (e: React.PointerEvent<HTMLDivElement>): DragMode => {
    if (isMilestoneTask(task) || task.isSummary) return "bar";

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width < MIN_RESIZABLE_WIDTH) return "bar";

    const relativeX = e.clientX - rect.left;

    if (relativeX <= EDGE_THRESHOLD) return "left";
    if (relativeX >= rect.width - EDGE_THRESHOLD) return "right";
    return "bar";
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Only the primary pointer's left button starts a drag (right-click and secondary touches are ignored)
    if (!e.isPrimary || e.button !== 0) return;
    // Ignore a second pointer while a drag is already running
    if (dragContextRef.current) return;

    const mode = detectDragMode(e);
    dragModeRef.current = mode;

    // Dragging a summary bar moves its whole subtree by the same delta
    const rawTasks = storeApi.getState().rawTasks;
    const taskIds = task.isSummary
      ? collectSubtreeIds(rawTasks, task.id)
      : [task.id];
    const movingIds = new Set(taskIds);
    const initialDates = new Map(
      rawTasks
        .filter((t) => movingIds.has(t.id))
        .map((t) => [
          t.id,
          { start: dayjs(t.startDate), end: dayjs(t.endDate) },
        ])
    );
    // The dragged bar itself uses the dates on screen (rolled up from children for a summary)
    initialDates.set(task.id, {
      start: dayjs(task.startDate),
      end: dayjs(task.endDate),
    });

    dragContextRef.current = {
      mode,
      pointerId: e.pointerId,
      initialClientX: e.clientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      initialBarWidth: task.barWidth,
      dragSteps: 0,
      basePxPerDragStep,
      scaleKey: selectedScale,
      taskId: task.id,
      taskIds,
      initialDates,
    };

    storeApi.getState().setCurrentTask(task);
    e.currentTarget.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (!ctx || moveEvent.pointerId !== ctx.pointerId) return;

      const deltaX = moveEvent.clientX - ctx.initialClientX;
      const rawSteps = Math.round(deltaX / ctx.basePxPerDragStep);

      // Clamp the step count itself so at least one step of width is left
      // (clamping only the preview and leaving the commit alone commits end < start)
      const maxShrinkSteps = Math.floor(
        (ctx.initialBarWidth - ctx.basePxPerDragStep) / ctx.basePxPerDragStep
      );
      let steps = rawSteps;
      if (ctx.mode === "left") steps = Math.min(rawSteps, maxShrinkSteps);
      if (ctx.mode === "right") steps = Math.max(rawSteps, -maxShrinkSteps);

      if (steps === ctx.dragSteps) return;
      ctx.dragSteps = steps;

      const draggedPx = steps * ctx.basePxPerDragStep;
      const shift = (date: Dayjs) => shiftByDragSteps(date, steps, ctx.scaleKey);

      let newStartDate: Dayjs;
      let newEndDate: Dayjs;
      let offsetX = 0;
      let offsetWidth = 0;

      switch (ctx.mode) {
        case "bar":
          newStartDate = shift(ctx.initialStartDate);
          newEndDate = shift(ctx.initialEndDate);
          offsetX = draggedPx;
          offsetWidth = 0;
          break;

        case "left":
          newStartDate = shift(ctx.initialStartDate);
          newEndDate = ctx.initialEndDate;
          offsetX = draggedPx;
          offsetWidth = -draggedPx;
          break;

        case "right":
          newStartDate = ctx.initialStartDate;
          newEndDate = shift(ctx.initialEndDate);
          offsetX = 0;
          offsetWidth = draggedPx;
          break;

        default:
          return;
      }

      // Descendants shift by the same pixels, but each keeps its own dates
      const offsets: Record<string, GanttDragOffset> = {};
      for (const id of ctx.taskIds) {
        const initial = ctx.initialDates.get(id);
        offsets[id] =
          id === ctx.taskId || !initial
            ? {
                offsetX,
                offsetWidth,
                offsetStartDate: newStartDate,
                offsetEndDate: newEndDate,
              }
            : {
                offsetX: draggedPx,
                offsetWidth: 0,
                offsetStartDate: shift(initial.start),
                offsetEndDate: shift(initial.end),
              };
      }

      storeApi.getState().setDragOffsets(offsets);
    };

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };

    const endDrag = (taskIds: string[]) => {
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
      storeApi.getState().clearDragOffsets(taskIds);
    };

    // When the browser cancels the gesture (scroll takeover, multi-touch, etc.) revert instead of committing
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (ctx && cancelEvent.pointerId !== ctx.pointerId) return;

      detachListeners();
      if (ctx) endDrag(ctx.taskIds);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const pending = dragContextRef.current;
      if (pending && upEvent.pointerId !== pending.pointerId) return;

      detachListeners();

      const ctx = pending;
      if (!ctx) {
        return;
      }

      if (ctx.dragSteps === 0) {
        endDrag(ctx.taskIds);
        return;
      }

      const currentRawTasks = storeApi.getState().rawTasks;
      const commit = (date: string) =>
        shiftByDragSteps(dayjs(date), ctx.dragSteps, ctx.scaleKey).toISOString();

      // However many tasks moved, there is one updated array - onTasksChange fires once
      const movedIds = new Set(ctx.taskIds);
      const updatedTasks = currentRawTasks.map((t) => {
        if (!movedIds.has(t.id)) return t;

        switch (ctx.mode) {
          case "bar":
            return {
              ...t,
              startDate: commit(t.startDate),
              endDate: commit(t.endDate),
            };

          case "left":
            return {
              ...t,
              startDate: commit(t.startDate),
            };

          case "right":
            return {
              ...t,
              endDate: commit(t.endDate),
            };

          default:
            return t;
        }
      });

      storeApi.getState().setRawTasks(updatedTasks);
      onTasksChangeRef.current?.(updatedTasks);

      // dragOffset is deliberately not cleared here - clearing it before the new
      // transformedTasks are computed makes the bar flick back to its old position for
      // one frame. Gantt's timeline recomputation effect clears it along with the new positions.
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

  return { 
    onPointerDown, 
    dragMode: dragModeRef.current 
  };
}
