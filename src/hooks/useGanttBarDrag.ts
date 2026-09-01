import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
  MIN_TOUCH_RESIZABLE_WIDTH,
  TOUCH_EDGE_THRESHOLD,
} from "constants/gantt";
import { Dayjs } from "dayjs";
import { useEffect, useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "stores/context";
import {
  GanttBeforeChangeHandler,
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
  buildTaskChange,
  mutationKey,
  REVERT_DURATION_MS,
} from "utils/mutation";
import { armPointerGesture, suppressTouchScroll } from "utils/pointerGesture";
import {
  clampDragDates,
  clampMoveDelta,
  pxBetweenDates,
  shiftByDragSteps,
} from "utils/timeline";
import { collectSubtreeIds } from "utils/tree";
import { edgeScrollVelocity } from "utils/viewport";

export type DragMode = GanttDragMode;

export interface GanttBarDragOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  onBeforeTaskChange?: GanttBeforeChangeHandler;
  /** Scroll the timeline when the drag reaches a viewport edge (default true) */
  autoScroll?: boolean;
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
  /** Claimed on the first movement - null while the gesture has not moved the bar yet */
  gateToken: number | null;
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
  options: GanttBarDragOptions = {},
  interaction?: GanttInteractionConfig
) {
  const storeApi = useGanttStoreApi();
  const dragContextRef = useRef<DragContext | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  // The pointerup that ends a drag is followed by a click - this tells the two apart
  const movedRef = useRef(false);
  /** Aborts a touch long press that has not lifted the bar yet */
  const pendingGestureRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // A row scrolled out of view while a finger rests on it must not lift later
  useEffect(() => () => pendingGestureRef.current?.(), []);

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
    // A finger covers far more than a cursor, so its edge zones are wider - and a bar
    // too short to spare them stays move-only, as it already does for the mouse
    const touch = e.pointerType !== "mouse";
    const edge = touch ? TOUCH_EDGE_THRESHOLD : EDGE_THRESHOLD;
    const minWidth = touch ? MIN_TOUCH_RESIZABLE_WIDTH : MIN_RESIZABLE_WIDTH;

    if (canResize && rect.width >= minWidth) {
      const relativeX = e.clientX - rect.left;
      if (relativeX <= edge) return "left";
      if (relativeX >= rect.width - edge) return "right";
    }

    return canMove ? "bar" : null;
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // Only the primary pointer's left button starts a drag (right-click and secondary touches are ignored)
    if (!e.isPrimary || e.button !== 0) return;
    // Ignore a second pointer while a drag is already running
    if (dragContextRef.current) return;
    // A press that was given up to a scroll leaves its abort behind - the primary
    // pointer can only be down once, so anything still pending belongs to the past
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const mode = detectDragMode(e);
    if (!mode) return;

    // currentTarget is only valid while the React event is being dispatched
    const element = e.currentTarget;
    const { pointerId, pointerType } = e;

    // A mouse press starts the drag now; a touch has to rest first, so a swipe across
    // a bar still scrolls the timeline
    pendingGestureRef.current = armPointerGesture(
      { pointerType, pointerId, clientX: e.clientX, clientY: e.clientY },
      (clientX) => {
        pendingGestureRef.current = null;
        startDrag(mode, pointerId, pointerType, clientX, element);
      }
    );
  };

  const startDrag = (
    mode: DragMode,
    pointerId: number,
    pointerType: string,
    initialClientX: number,
    element: HTMLDivElement
  ) => {
    dragModeRef.current = mode;
    movedRef.current = false;

    // The bar lives inside the scroll container, so no ref plumbing is needed to find it
    const scrollEl = element.closest<HTMLElement>(
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
      pointerId,
      initialClientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      initialBarWidth: task.barWidth,
      dragSteps: 0,
      basePxPerDragStep,
      lastClientX: initialClientX,
      autoScrollPx: 0,
      scaleKey: selectedScale,
      taskId: task.id,
      taskIds,
      initialDates,
      gateToken: null,
      bounds,
      boundedMembers,
      moveDeltaMs: null,
      clamped: null,
    };

    storeApi.getState().setCurrentTask(task);
    // A mouse press focuses the bar on its own, a touch does not - without this the
    // undo shortcut would work after a mouse drag and do nothing after a touch one
    element.focus({ preventScroll: true });
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // The pointer is already gone (a touch released as the long press fired) -
      // pointerup/pointercancel below still tear the drag down
    }

    // Bars let touch scroll the timeline, so the scroll has to be held off by hand for
    // as long as this drag owns the finger. No effect on a mouse drag.
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

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
      movedRef.current = true;

      // The lane is claimed the moment the bar actually moves, so a veto still awaiting an
      // answer for an earlier gesture on this bar knows it has been superseded
      if (ctx.gateToken === null) {
        ctx.gateToken = storeApi
          .getState()
          .mutationGate.begin(mutationKey("move", ctx.taskId));
      }

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

    /**
     * Puts back the scrolling this drag caused
     *
     * The timeline only followed the bar. When the gesture is discarded - cancelled, or
     * vetoed after the fact - the bar goes back to where it started, and leaving the
     * viewport parked where the data never moved to would strand the user looking at
     * empty timeline. Relative, so a manual scroll during a pending veto still stands,
     * and so does a range extension's own compensation.
     */
    const undoAutoScroll = (ctx: DragContext) => {
      if (!scrollEl || !ctx.autoScrollPx) return;

      scrollEl.scrollBy({ left: -ctx.autoScrollPx, behavior: "smooth" });
      ctx.autoScrollPx = 0;
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
      if (optionsRef.current.autoScroll === false || !scrollEl) return;

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
      releaseTouchScroll?.();
    };

    const endDrag = (ctx: DragContext) => {
      undoAutoScroll(ctx);
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
      storeApi.getState().clearDragOffsets(ctx.taskIds);
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
      const shiftDate = (date: string) =>
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
              startDate: shiftDate(t.startDate),
              endDate: shiftDate(t.endDate),
            };

          case "left":
            return {
              ...t,
              startDate: clampedStart ?? shiftDate(t.startDate),
            };

          case "right":
            return {
              ...t,
              endDate: clampedEnd ?? shiftDate(t.endDate),
            };

          default:
            return t;
        }
      });

      const change = buildTaskChange({
        type: ctx.mode === "bar" ? "move" : "resize",
        taskId: ctx.taskId,
        changedIds: ctx.taskIds,
        previous: currentRawTasks,
        next: updatedTasks,
        edge:
          ctx.mode === "left" ? "start" : ctx.mode === "right" ? "end" : undefined,
      });

      // Written against the tasks as they are at commit time, not against the snapshot
      // taken at drop - another bar may have committed while a veto was in flight
      const commit = () => {
        const edited = new Map(change.changedTasks.map((t) => [t.id, t]));
        const merged = storeApi
          .getState()
          .rawTasks.map((t) => edited.get(t.id) ?? t);

        // The undo step is recorded here, not at drop: commitTasks diffs against the
        // same rawTasks the merge above just read, so undo writes back the values that
        // were really replaced even when another bar committed while a veto was pending.
        // A rollback or a stale answer never reaches this function, so neither is a step.
        storeApi.getState().commitTasks(merged);
        optionsRef.current.onTasksChange?.(merged);
      };

      // Nothing was written, so dropping the drag offsets puts the bar back where it
      // started - the reverting flag is only there to make that a transition
      const rollback = () => {
        undoAutoScroll(ctx);
        const state = storeApi.getState();
        state.beginRevert(ctx.taskIds);
        state.clearDragOffsets(ctx.taskIds);
        setTimeout(
          () => storeApi.getState().endRevert(ctx.taskIds),
          REVERT_DURATION_MS
        );
      };

      // dragOffset is deliberately not cleared here - clearing it before the new
      // transformedTasks are computed makes the bar flick back to its old position for
      // one frame. Gantt's timeline recomputation effect clears it along with the new positions.
      // While a before-handler is pending it is what holds the bar at the dropped position.
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);

      const onBeforeTaskChange = optionsRef.current.onBeforeTaskChange;
      if (!onBeforeTaskChange || ctx.gateToken === null) {
        commit();
        return;
      }

      void storeApi
        .getState()
        .mutationGate.settle(
          mutationKey("move", ctx.taskId),
          ctx.gateToken,
          onBeforeTaskChange,
          change
        )
        .then((outcome) => {
          if (outcome === "commit") commit();
          else if (outcome === "rollback") rollback();
          // 'stale' - a newer gesture owns this bar, so this answer is dropped
        });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

  /**
   * Reports whether the click now arriving is the tail of a drag, and clears the flag
   *
   * The browser fires a click after the pointerup that ended a gesture; that click is the
   * end of the drag, not a selection.
   */
  const consumeDragClick = (): boolean => {
    if (!movedRef.current) return false;
    movedRef.current = false;
    return true;
  };

  return {
    onPointerDown,
    dragMode: dragModeRef.current,
    consumeDragClick,
  };
}
