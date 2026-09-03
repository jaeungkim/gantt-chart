import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
  MIN_TOUCH_RESIZABLE_WIDTH,
  TOUCH_EDGE_THRESHOLD,
} from "shared/constants";
import { Dayjs } from "dayjs";
import { useEffect, useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import {
  GanttDragBounds,
  GanttDragMode,
  GanttDragOffset,
  GanttScaleKey,
} from "shared/types";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import type { WorkingCalendar } from "../../core";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";
import {
  clampDragDates,
  clampMoveDelta,
  pxBetweenDates,
  shiftByDragSteps,
} from "timeline/utils/geometry";
import { collectSubtreeIds } from "core/tree";
import { edgeScrollVelocity } from "timeline/utils/viewport";

export type DragMode = GanttDragMode;

interface GanttBarDragOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
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
  /** Extra days the working-day calendar snapped the last frame by (0 when it is off) */
  snapDays: number;
  /** The dragged bar's own bounds - null when it has none. Used by the resize modes. */
  bounds: GanttDragBounds | null;
  /** Moving tasks that have bounds, with their starting dates - a move clamps against all of them */
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

/** Gantt bar drag behavior; `autoScroll` (default true) scrolls the timeline at a viewport edge. */
export function useGanttBarDrag(
  task: TaskTransformed,
  options: GanttBarDragOptions = {},
  interaction?: GanttInteractionConfig,
  calendar?: WorkingCalendar
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

  // null when no gesture is allowed; edge zones need a resizable bar wide enough to spare them
  const detectDragMode = (
    e: React.PointerEvent<HTMLDivElement>
  ): DragMode | null => {
    const rect = e.currentTarget.getBoundingClientRect();
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
    if (!e.isPrimary || e.button !== 0) return;
    // Ignore a second pointer while a drag is already running
    if (dragContextRef.current) return;
    // Anything still pending belongs to a past press - the primary pointer is down once
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const mode = detectDragMode(e);
    if (!mode) return;

    // currentTarget is only valid while the React event is being dispatched
    const element = e.currentTarget;
    const { pointerId, pointerType } = e;

    // Mouse drags start now; touch must rest first so a swipe still scrolls the timeline
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

    // Each moving task resolves its own bounds, so a descendant constrains a subtree drag too
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
      snapDays: 0,
      bounds,
      boundedMembers,
      moveDeltaMs: null,
      clamped: null,
    };

    storeApi.getState().setCurrentTask(task);
    storeApi.getState().setDragMode(mode);
    // A touch press does not focus the bar; without this the keyboard loses it after a touch drag
    element.focus({ preventScroll: true });
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Pointer already gone; pointerup/pointercancel below still tear the drag down
    }

    // Touch scrolling must be held off by hand for as long as this drag owns the finger
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    // Recomputes from the last known pointer position - auto-scroll frames bring no new event
    const applyMove = () => {
      const ctx = dragContextRef.current;
      if (!ctx) return;

      const deltaX =
        ctx.lastClientX - ctx.initialClientX + ctx.autoScrollPx;
      const rawSteps = Math.round(deltaX / ctx.basePxPerDragStep);

      // Clamp the step count, not just the preview - otherwise the commit lands end < start
      const maxShrinkSteps = Math.floor(
        (ctx.initialBarWidth - ctx.basePxPerDragStep) / ctx.basePxPerDragStep
      );
      let steps = rawSteps;
      if (ctx.mode === "left") steps = Math.min(rawSteps, maxShrinkSteps);
      if (ctx.mode === "right") steps = Math.max(rawSteps, -maxShrinkSteps);

      if (steps === ctx.dragSteps) return;
      ctx.dragSteps = steps;
      movedRef.current = true;

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
      }

      // Snap to a working day before the bounds clamp below, so a hard min/max always wins
      let snapDays = 0;
      if (calendar?.skipsNonWorkingDays) {
        const anchor = ctx.mode === "right" ? newEndDate : newStartDate;
        const snapped = calendar.snapForward(anchor);
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

      // Offsets come from the clamped dates, not the raw steps, so the bar stops on the bound
      if (ctx.mode === "bar") {
        if (ctx.boundedMembers.length) {
          // One shared delta, shrunk to the tightest member bound, keeps the subtree rigid
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
      }

      storeApi.getState().setDragOffsets(offsets);
    };

    let autoScrollFrame: number | null = null;
    let velocity = 0;

    const stopAutoScroll = () => {
      if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = null;
      velocity = 0;
    };

    // Puts back this drag's scrolling; relative, so a manual scroll meanwhile still stands
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

      // Nothing moved means the range ends here - keep the loop alive so it resumes if it extends
      if (moved !== 0) {
        ctx.autoScrollPx += moved;
        applyMove();
      }

      autoScrollFrame = requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = (clientX: number) => {
      if (optionsRef.current.autoScroll === false || !scrollEl) return;

      // The pinned task list covers the left, so the timeline's left edge is where that pane ends
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
      storeApi.getState().setDragMode(null);
      storeApi.getState().clearDragOffsets(ctx.taskIds);
    };

    // A cancelled gesture (scroll takeover, multi-touch) reverts instead of committing
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
      // A clamped move commits the shared delta; unclamped, the plain step shift
      const shiftDate = (date: string) =>
        ctx.moveDeltaMs !== null
          ? dayjs(date).add(ctx.moveDeltaMs, "millisecond").toISOString()
          : shiftByDragSteps(dayjs(date), ctx.dragSteps, ctx.scaleKey)
              .add(ctx.snapDays, "day")
              .toISOString();

      // A clamped resize reports exactly the bound to onTasksChange
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
        }
      });

      // Clearing dragOffset here flicks the bar back a frame; Gantt's recompute effect clears it
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
      storeApi.getState().setDragMode(null);

      const edited = new Map(
        draggedTasks.filter((t) => movedIds.has(t.id)).map((t) => [t.id, t])
      );
      const merged = storeApi
        .getState()
        .rawTasks.map((t) => edited.get(t.id) ?? t);

      storeApi.getState().setRawTasks(merged);
      optionsRef.current.onTasksChange?.(merged);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

  /** True when the click now arriving is the tail of a drag, not a selection; clears the flag. */
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
