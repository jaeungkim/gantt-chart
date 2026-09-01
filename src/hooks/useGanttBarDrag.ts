import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
} from "constants/gantt";
import { Dayjs } from "dayjs";
import { useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "stores/context";
import {
  GanttDragBounds,
  GanttDragMode,
  GanttDragOffset,
  GanttScaleKey,
} from "types/gantt";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
import dayjs from "utils/dayjs";
import {
  clampDragDates,
  clampMoveDelta,
  pxBetweenDates,
  shiftByDragSteps,
} from "utils/timeline";
import { collectSubtreeIds } from "utils/tree";
import { edgeScrollVelocity } from "utils/viewport";

export type DragMode = GanttDragMode;

interface DragContext {
  mode: DragMode;
  pointerId: number;
  initialClientX: number;
  initialStartDate: Dayjs;
  initialEndDate: Dayjs;
  initialBarWidth: number;
  dragSteps: number;
  basePxPerDragStep: number;
  /** Last pointer position, so an auto-scroll frame can recompute without a new event */
  lastClientX: number;
  /** How far the timeline has auto-scrolled since the drag started (px) */
  autoScrollPx: number;
  // Keep computing in the step unit from when the drag started, even if the scale changes mid-drag
  scaleKey: GanttScaleKey;
  taskId: string;
  /** Tasks that move together - the whole subtree for a summary row, otherwise just itself */
  taskIds: string[];
  /** Dates the moving tasks had when the drag started */
  initialDates: Map<string, { start: Dayjs; end: Dayjs }>;
  /** The dragged bar's own bounds - null when it has none. Used by the resize modes. */
  bounds: GanttDragBounds | null;
  /**
   * Every moving task that has bounds, with the dates it started from
   *
   * Empty means nothing in the drag is bounded, and the math below is left exactly
   * as it was. Otherwise a move is clamped against all of them at once, so a
   * descendant's bounds constrain a subtree drag too.
   */
  boundedMembers: { start: Dayjs; end: Dayjs; bounds: GanttDragBounds }[];
  /** Shared clamped move, in ms - every moving task shifts by it. null when unclamped. */
  moveDeltaMs: number | null;
  /** Latest bound-clamped dates for a resize, committed instead of a plain step shift */
  clamped: { startDate: Dayjs; endDate: Dayjs } | null;
}

/** Parses the bound props into dayjs, or null when neither end is set */
function toDragBounds(
  min: string | undefined,
  max: string | undefined
): GanttDragBounds | null {
  if (!min && !max) return null;
  return {
    min: min ? dayjs(min) : undefined,
    max: max ? dayjs(max) : undefined,
  };
}

/**
 * Hook providing the Gantt bar drag behavior
 *
 * `autoScroll` (default on) scrolls the timeline when the drag reaches a viewport edge,
 * faster the closer the pointer gets, and stops on drop or cancel.
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
  interaction?: GanttInteractionConfig,
  autoScroll = true
) {
  const storeApi = useGanttStoreApi();
  const dragContextRef = useRef<DragContext | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const onTasksChangeRef = useRef(onTasksChange);
  onTasksChangeRef.current = onTasksChange;

  const selectedScale = useGanttStore((s) => s.selectedScale);
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];

  const { canMove, canResize, minDate, maxDate } = resolveTaskInteraction(
    task,
    interaction
  );

  // Detect the drag mode
  // Milestones, summaries, narrow bars and tasks with resizing disabled cannot be
  // resized - keeps the edge zones from covering the whole bar and blocking the move.
  // (canResize already folds in the milestone and summary rules)
  // Returns null when the gesture is not allowed at all, so no drag starts
  const detectDragMode = (
    e: React.PointerEvent<HTMLDivElement>
  ): DragMode | null => {
    const rect = e.currentTarget.getBoundingClientRect();

    if (canResize && rect.width >= MIN_RESIZABLE_WIDTH) {
      const relativeX = e.clientX - rect.left;
      if (relativeX <= EDGE_THRESHOLD) return "left";
      if (relativeX >= rect.width - EDGE_THRESHOLD) return "right";
    }

    return canMove ? "bar" : null;
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Only the primary pointer's left button starts a drag (right-click and secondary touches are ignored)
    if (!e.isPrimary || e.button !== 0) return;
    // Ignore a second pointer while a drag is already running
    if (dragContextRef.current) return;

    const mode = detectDragMode(e);
    if (!mode) return;
    dragModeRef.current = mode;

    // The bar lives inside the scroll container, so no ref plumbing is needed to find it
    const scrollEl = e.currentTarget.closest<HTMLElement>(
      ".gantt-scroll-container"
    );

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

    // Bounds for everything that moves. Each task resolves its own, so a descendant
    // carried along by a summary drag still cannot be pushed out of its own window.
    const bounds = toDragBounds(minDate, maxDate);
    const boundedMembers: DragContext["boundedMembers"] = [];
    for (const t of rawTasks) {
      if (!movingIds.has(t.id)) continue;

      const initial = initialDates.get(t.id);
      if (!initial) continue;

      // The dragged bar's own bounds are already resolved above
      const member = resolveTaskInteraction(t, interaction);
      const own =
        t.id === task.id
          ? bounds
          : toDragBounds(member.minDate, member.maxDate);

      if (own) {
        boundedMembers.push({
          start: initial.start,
          end: initial.end,
          bounds: own,
        });
      }
    }

    dragContextRef.current = {
      mode,
      pointerId: e.pointerId,
      initialClientX: e.clientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      initialBarWidth: task.barWidth,
      dragSteps: 0,
      basePxPerDragStep,
      lastClientX: e.clientX,
      autoScrollPx: 0,
      scaleKey: selectedScale,
      taskId: task.id,
      taskIds,
      initialDates,
      bounds,
      boundedMembers,
      moveDeltaMs: null,
      clamped: null,
    };

    storeApi.getState().setCurrentTask(task);
    e.currentTarget.setPointerCapture(e.pointerId);

    // Recomputes the drag from the last known pointer position - called both by pointer
    // events and by the auto-scroll frames, where the pointer itself never moves
    const applyMove = () => {
      const ctx = dragContextRef.current;
      if (!ctx) return;

      const deltaX =
        ctx.lastClientX - ctx.initialClientX + ctx.autoScrollPx;
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

      // Snap to the allowed window. Offsets are then measured from the clamped
      // dates rather than the raw step count, so the bar stops on the bound
      // instead of overshooting it.
      if (ctx.mode === "bar") {
        if (ctx.boundedMembers.length) {
          // Everything in the drag moves by one shared delta, shrunk to whatever
          // the tightest member bound allows - the subtree stays rigid and no bar
          // in it leaves its own window
          const requestedMs =
            newStartDate.valueOf() - ctx.initialStartDate.valueOf();
          const deltaMs = clampMoveDelta(
            ctx.boundedMembers,
            requestedMs,
            ctx.scaleKey
          );
          ctx.moveDeltaMs = deltaMs;
          newStartDate = ctx.initialStartDate.add(deltaMs, "millisecond");
          newEndDate = ctx.initialEndDate.add(deltaMs, "millisecond");
        }
      } else if (ctx.bounds) {
        // Resizes only ever touch the dragged bar, so its own bounds are enough
        const clamped = clampDragDates(
          ctx.mode,
          newStartDate,
          newEndDate,
          ctx.bounds,
          ctx.scaleKey
        );
        ctx.clamped = clamped;
        newStartDate = clamped.startDate;
        newEndDate = clamped.endDate;
      }

      if (ctx.moveDeltaMs !== null || ctx.clamped) {
        const startPx = pxBetweenDates(
          ctx.initialStartDate,
          newStartDate,
          ctx.scaleKey
        );
        const endPx = pxBetweenDates(
          ctx.initialEndDate,
          newEndDate,
          ctx.scaleKey
        );
        offsetX = startPx;
        offsetWidth = endPx - startPx;
      }

      // Descendants shift by the same amount, but each keeps its own dates
      const memberShift =
        ctx.moveDeltaMs !== null
          ? (date: Dayjs) => date.add(ctx.moveDeltaMs as number, "millisecond")
          : shift;
      const memberPx = ctx.moveDeltaMs !== null ? offsetX : draggedPx;

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
                offsetX: memberPx,
                offsetWidth: 0,
                offsetStartDate: memberShift(initial.start),
                offsetEndDate: memberShift(initial.end),
              };
      }

      storeApi.getState().setDragOffsets(offsets);
    };

    // ===== Edge auto-scroll =====
    let autoScrollFrame: number | null = null;
    let velocity = 0;

    const stopAutoScroll = () => {
      if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
      velocity = 0;
    };

    const runAutoScroll = () => {
      autoScrollFrame = null;
      const ctx = dragContextRef.current;
      if (!ctx || !scrollEl || velocity === 0) return;

      const before = scrollEl.scrollLeft;
      scrollEl.scrollLeft = before + velocity;
      const moved = scrollEl.scrollLeft - before;

      // Nothing moved means the range ends here - keep the loop alive anyway, so the drag
      // resumes by itself once the range extends
      if (moved !== 0) {
        ctx.autoScrollPx += moved;
        applyMove();
      }

      autoScrollFrame = requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = (clientX: number) => {
      if (!autoScroll || !scrollEl) return;

      // The pinned task list covers the left of the viewport, so the timeline's own left
      // edge starts where the pane ends
      const rect = scrollEl.getBoundingClientRect();
      const gridEl = scrollEl.querySelector<HTMLElement>(".gantt-grid");
      velocity = edgeScrollVelocity(
        clientX,
        rect.left + (gridEl?.offsetWidth ?? 0),
        rect.right
      );

      if (velocity === 0) {
        stopAutoScroll();
      } else if (autoScrollFrame === null) {
        autoScrollFrame = requestAnimationFrame(runAutoScroll);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (!ctx || moveEvent.pointerId !== ctx.pointerId) return;

      ctx.lastClientX = moveEvent.clientX;
      updateAutoScroll(moveEvent.clientX);
      applyMove();
    };

    const detachListeners = () => {
      stopAutoScroll();
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
      // A clamped move commits the shared delta, so every task in the subtree lands
      // where its preview was; unclamped, it is the plain step shift as before
      const commit = (date: string) =>
        ctx.moveDeltaMs !== null
          ? dayjs(date).add(ctx.moveDeltaMs, "millisecond").toISOString()
          : shiftByDragSteps(
              dayjs(date),
              ctx.dragSteps,
              ctx.scaleKey
            ).toISOString();

      // A clamped resize commits the clamped dates, so a bar dropped against a
      // bound reports exactly the bound to onTasksChange
      const clampedStart = ctx.clamped?.startDate.toISOString();
      const clampedEnd = ctx.clamped?.endDate.toISOString();

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
              startDate: clampedStart ?? commit(t.startDate),
            };

          case "right":
            return {
              ...t,
              endDate: clampedEnd ?? commit(t.endDate),
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
