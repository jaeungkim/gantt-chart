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
  GanttScheduling,
} from "types/gantt";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
import dayjs from "core/dates";
import { scheduleTasks } from "core";
import {
  clampDragDates,
  clampMoveDelta,
  pxBetweenDates,
  shiftByDragSteps,
} from "utils/timeline";
import { collectSubtreeIds } from "core/tree";

export type DragMode = GanttDragMode;

/** The dates the drag is proposing for the tasks it moves directly */
type DraggedDates = Map<string, { start: Dayjs; end: Dayjs }>;

/** The task array with the dragged tasks' proposed dates written in */
function applyDraggedDates(rawTasks: Task[], dragged: DraggedDates): Task[] {
  return rawTasks.map((t) => {
    const next = dragged.get(t.id);
    return next
      ? {
          ...t,
          startDate: next.start.toISOString(),
          endDate: next.end.toISOString(),
        }
      : t;
  });
}

/**
 * Runs the scheduling engine for the tasks the drag is moving.
 * The dragged tasks are the seeds, so only what they reach is rescheduled and the bar
 * under the pointer stays exactly where the pointer put it.
 */
function reschedule(
  rawTasks: Task[],
  dragged: DraggedDates,
  scheduling: GanttScheduling
) {
  return scheduleTasks(applyDraggedDates(rawTasks, dragged), {
    policy: scheduling.policy,
    calendar: scheduling.calendar,
    hierarchy: scheduling.hierarchy,
    seeds: [...dragged.keys()],
    onCycle: scheduling.onCycle,
  });
}

/**
 * Live offsets for the successors this frame moved.
 *
 * The engine speaks in dates and the preview layer in pixels, so each successor's date
 * delta goes through the same px-per-drag-step ratio the dragged bar itself uses. Their
 * duration never changes, so the width offset is always zero.
 */
function previewOffsets(
  rawTasks: Task[],
  dragged: DraggedDates,
  scaleKey: GanttScaleKey,
  scheduling: GanttScheduling
): { offsets: Record<string, GanttDragOffset>; ids: string[] } {
  const result = reschedule(rawTasks, dragged, scheduling);
  if (!result.movedIds.length) return { offsets: {}, ids: [] };

  const before = new Map(rawTasks.map((t) => [t.id, t]));
  const after = new Map(result.tasks.map((t) => [t.id, t]));
  const offsets: Record<string, GanttDragOffset> = {};

  for (const id of result.movedIds) {
    const original = before.get(id);
    const moved = after.get(id);
    if (!original || !moved) continue;

    const offsetStartDate = dayjs(moved.startDate);

    offsets[id] = {
      offsetX: pxBetweenDates(dayjs(original.startDate), offsetStartDate, scaleKey),
      offsetWidth: 0,
      offsetStartDate,
      offsetEndDate: dayjs(moved.endDate),
    };
  }

  return { offsets, ids: result.movedIds };
}

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
  /** Successors the last preview frame moved - cleared when they stop moving */
  previewIds: string[];
  /** Extra days the working-day calendar snapped the last frame by (0 when it is off) */
  snapDays: number;
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
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
  interaction?: GanttInteractionConfig,
  scheduling?: GanttScheduling
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
      scaleKey: selectedScale,
      taskId: task.id,
      taskIds,
      initialDates,
      previewIds: [],
      snapDays: 0,
      bounds,
      boundedMembers,
      moveDeltaMs: null,
      clamped: null,
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

      // With the working-day calendar on, a drop lands on a working day: the edge that
      // moved snaps forward and everything moving with it follows by the same days.
      // Done before the bounds clamp below, so a hard min/max always has the last word -
      // a bar pinned to its bound may sit on a non-working day, the bound may not move.
      let snapDays = 0;
      if (scheduling?.calendar.skipsNonWorkingDays) {
        const anchor = ctx.mode === "right" ? newEndDate : newStartDate;
        const snapped = scheduling.calendar.snapForward(anchor);
        snapDays = snapped.diff(anchor, "day");

        // A left-edge resize must not snap past the bar's own end
        if (ctx.mode === "left" && snapped.valueOf() >= newEndDate.valueOf()) {
          snapDays = 0;
        }
      }
      ctx.snapDays = snapDays;

      const snapPx = snapDays
        ? pxBetweenDates(
            newStartDate,
            newStartDate.add(snapDays, "day"),
            ctx.scaleKey
          )
        : 0;

      if (snapDays) {
        if (ctx.mode !== "right") {
          newStartDate = newStartDate.add(snapDays, "day");
          offsetX += snapPx;
        }
        if (ctx.mode !== "left") {
          newEndDate = newEndDate.add(snapDays, "day");
        }
        if (ctx.mode === "left") offsetWidth -= snapPx;
        if (ctx.mode === "right") offsetWidth += snapPx;
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
          : (date: Dayjs) => shift(date).add(snapDays, "day");
      const memberPx =
        ctx.moveDeltaMs !== null ? offsetX : draggedPx + snapPx;

      const offsets: Record<string, GanttDragOffset> = {};
      const draggedDates: DraggedDates = new Map();
      for (const id of ctx.taskIds) {
        const initial = ctx.initialDates.get(id);
        const isDraggedBar = id === ctx.taskId || !initial;
        const start = isDraggedBar ? newStartDate : memberShift(initial.start);
        const end = isDraggedBar ? newEndDate : memberShift(initial.end);

        offsets[id] = {
          offsetX: isDraggedBar ? offsetX : memberPx,
          offsetWidth: isDraggedBar ? offsetWidth : 0,
          offsetStartDate: start,
          offsetEndDate: end,
        };
        draggedDates.set(id, { start, end });
      }

      // Preview the successors this move pushes around, and drop the ones it no longer does
      if (scheduling && scheduling.policy !== "off") {
        const preview = previewOffsets(
          storeApi.getState().rawTasks,
          draggedDates,
          ctx.scaleKey,
          scheduling
        );
        const stale = ctx.previewIds.filter((id) => !(id in preview.offsets));
        ctx.previewIds = preview.ids;
        if (stale.length) storeApi.getState().clearDragOffsets(stale);
        Object.assign(offsets, preview.offsets);
      }

      storeApi.getState().setDragOffsets(offsets);
    };

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };

    const endDrag = (ctx: DragContext) => {
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
      storeApi.getState().clearDragOffsets([...ctx.taskIds, ...ctx.previewIds]);
    };

    // When the browser cancels the gesture (scroll takeover, multi-touch, etc.) revert instead of committing
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (ctx && cancelEvent.pointerId !== ctx.pointerId) return;

      detachListeners();
      if (ctx) endDrag(ctx);
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
        endDrag(ctx);
        return;
      }

      const currentRawTasks = storeApi.getState().rawTasks;
      // A clamped move commits the shared delta, so every task in the subtree lands
      // where its preview was; unclamped, it is the plain step shift as before
      const commit = (date: string) =>
        ctx.moveDeltaMs !== null
          ? dayjs(date).add(ctx.moveDeltaMs, "millisecond").toISOString()
          : shiftByDragSteps(dayjs(date), ctx.dragSteps, ctx.scaleKey)
              .add(ctx.snapDays, "day")
              .toISOString();

      // A clamped resize commits the clamped dates, so a bar dropped against a
      // bound reports exactly the bound to onTasksChange
      const clampedStart = ctx.clamped?.startDate.toISOString();
      const clampedEnd = ctx.clamped?.endDate.toISOString();

      // However many tasks moved, there is one updated array - onTasksChange fires once
      const movedIds = new Set(ctx.taskIds);
      const draggedTasks = currentRawTasks.map((t) => {
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

      // One commit: the drag and everything it pushed land in the same array
      const draggedDates: DraggedDates = new Map(
        draggedTasks
          .filter((t) => movedIds.has(t.id))
          .map((t) => [t.id, { start: dayjs(t.startDate), end: dayjs(t.endDate) }])
      );
      const updatedTasks =
        scheduling && scheduling.policy !== "off"
          ? reschedule(draggedTasks, draggedDates, scheduling).tasks
          : draggedTasks;

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
