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
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttDragMode, GanttDragOffset } from "shared/types";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import type { WorkingCalendar } from "core/calendar";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";
import {
  clampDragDates,
  clampMoveDelta,
  collectMoveMembers,
  pxBetweenDates,
  shiftByDragSteps,
  timelineRange,
  toDragBounds,
} from "features/timeline/utils/geometry";
import { collectSubtreeIds } from "core/tree";
import { edgeScrollVelocity, timelineEdges } from "features/timeline/utils/viewport";
import { scrollBehavior } from "features/timeline/hooks/useGanttScrollApi";

interface GanttBarDragOptions {
  onTasksChange?: (updatedTasks: Task[]) => void;
  autoScroll?: boolean;
}

export function resizeEdgeAt(
  rect: DOMRect,
  clientX: number,
  pointerType: string
): "left" | "right" | null {
  const touch = pointerType !== "mouse";
  const edge = touch ? TOUCH_EDGE_THRESHOLD : EDGE_THRESHOLD;
  const minWidth = touch ? MIN_TOUCH_RESIZABLE_WIDTH : MIN_RESIZABLE_WIDTH;
  if (rect.width < minWidth) return null;

  const relativeX = clientX - rect.left;
  if (relativeX <= edge) return "left";
  if (relativeX >= rect.width - edge) return "right";
  return null;
}

/** Gantt bar drag behavior; `autoScroll` (default true) scrolls the timeline at a viewport edge. */
export function useGanttBarDrag(
  task: TaskTransformed,
  options: GanttBarDragOptions,
  interaction?: GanttInteractionConfig,
  calendar?: WorkingCalendar
) {
  const storeApi = useGanttStoreApi();
  const draggingRef = useRef(false);
  // The pointerup that ends a drag is followed by a click - this tells the two apart
  const movedRef = useRef(false);
  /** Aborts a touch long press that has not lifted the bar yet */
  const pendingGestureRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useLatestRef(options);

  // A row scrolled out of view while a finger rests on it must not lift later
  useEffect(
    () => () => {
      pendingGestureRef.current?.();
      cleanupRef.current?.();
    },
    []
  );

  const selectedScale = useGanttStore((s) => s.selectedScale);
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];

  const { canMove, canResize, minDate, maxDate } = resolveTaskInteraction(
    task,
    interaction
  );

  // null when no gesture is allowed; edge zones need a resizable bar wide enough to spare them
  const detectDragMode = (
    e: React.PointerEvent<HTMLDivElement>
  ): GanttDragMode | null => {
    const edge = canResize
      ? resizeEdgeAt(e.currentTarget.getBoundingClientRect(), e.clientX, e.pointerType)
      : null;
    return edge ?? (canMove ? "bar" : null);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    // Ignore a second pointer while a drag is already running
    if (draggingRef.current) return;
    // Touch drags end without a click to consume the flag, so each press starts clean.
    movedRef.current = false;
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
    mode: GanttDragMode,
    pointerId: number,
    pointerType: string,
    initialClientX: number,
    element: HTMLDivElement
  ) => {
    const scrollEl = element.closest<HTMLElement>(
      ".gantt-scroll-container"
    );

    // Dragging a summary bar moves its whole subtree by the same delta
    const rawTasks = storeApi.getState().rawTasks;
    const taskIds = task.isSummary
      ? collectSubtreeIds(rawTasks, task.id)
      : [task.id];
    const movingIds = new Set(taskIds);

    // The dragged bar's own bounds - null when it has none
    const bounds = toDragBounds(minDate, maxDate);
    // Moving tasks that have bounds, with their starting dates - a move clamps against all of them
    const boundedMembers = collectMoveMembers(
      rawTasks,
      movingIds,
      task,
      bounds,
      interaction
    );

    draggingRef.current = true;
    const taskStart = dayjs(task.startDate);
    const taskEnd = dayjs(task.endDate);
    const drawn = timelineRange(
      storeApi.getState().bottomRowCells,
      selectedScale
    );
    // A resize drags the edge as drawn: a date past the timeline, or an open one, is drawn at its edge.
    // An open date anchors there in every mode, so no step math sees NaN.
    const initialStartDate =
      drawn &&
      (!taskStart.isValid() || (mode === "left" && !taskStart.isAfter(drawn.start)))
        ? drawn.start
        : taskStart;
    const initialEndDate =
      drawn &&
      (!taskEnd.isValid() || (mode === "right" && !taskEnd.isBefore(drawn.end)))
        ? drawn.end
        : taskEnd;
    let dragSteps = 0;
    let lastClientX = initialClientX;
    // How far the timeline has auto-scrolled since the drag started (px)
    let autoScrollPx = 0;
    // Extra days the working-day calendar snapped the last frame by (0 when it is off)
    let snapDays = 0;
    // Shared clamped move, in ms - every moving task shifts by it. null when unclamped.
    let moveDeltaMs: number | null = null;
    // Latest bound-clamped dates for a resize
    let clamped: { startDate: Dayjs; endDate: Dayjs } | null = null;
    let resizedEdge = mode === "left" ? initialStartDate : initialEndDate;

    storeApi.getState().setBarDrag({ task, mode });
    // Capture throws if the pointer is already gone; pointerup/pointercancel below still tear the drag down
    try {
      element.setPointerCapture(pointerId);
    } catch {}

    // Touch scrolling must be held off by hand for as long as this drag owns the finger
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    // Recomputes from the last known pointer position - auto-scroll frames bring no new event
    const applyMove = () => {
      const deltaX = lastClientX - initialClientX + autoScrollPx;
      const rawSteps = Math.round(deltaX / basePxPerDragStep);

      // Clamp the step count, not just the preview - otherwise the commit lands end < start
      const maxShrinkSteps = Math.floor(
        (task.barWidth - basePxPerDragStep) / basePxPerDragStep
      );
      let steps = rawSteps;
      if (mode === "left") steps = Math.min(rawSteps, maxShrinkSteps);
      if (mode === "right") steps = Math.max(rawSteps, -maxShrinkSteps);
      // A clipped edge already sits at the timeline's edge; outward it would only move a hidden date.
      if (mode === "left" && initialStartDate !== taskStart) steps = Math.max(steps, 0);
      if (mode === "right" && initialEndDate !== taskEnd) steps = Math.min(steps, 0);

      if (steps === dragSteps) return;
      dragSteps = steps;
      movedRef.current = true;

      // Release at zero steps commits nothing, so the preview shows nothing moved either.
      if (steps === 0) {
        storeApi.getState().clearDragOffsets(taskIds);
        return;
      }

      const draggedPx = steps * basePxPerDragStep;
      const shift = (date: Dayjs) => shiftByDragSteps(date, steps, selectedScale);

      let newStartDate: Dayjs;
      let newEndDate: Dayjs;
      let offsetX = 0;
      let offsetWidth = 0;

      switch (mode) {
        case "bar":
          newStartDate = shift(initialStartDate);
          newEndDate = shift(initialEndDate);
          offsetX = draggedPx;
          offsetWidth = 0;
          break;

        case "left":
          newStartDate = shift(initialStartDate);
          newEndDate = initialEndDate;
          offsetX = draggedPx;
          offsetWidth = -draggedPx;
          break;

        case "right":
          newStartDate = initialStartDate;
          newEndDate = shift(initialEndDate);
          offsetX = 0;
          offsetWidth = draggedPx;
          break;
      }

      // Snap to a working day before the bounds clamp below, so a hard min/max always wins
      snapDays = 0;
      if (calendar?.skipsNonWorkingDays) {
        // The end is exclusive, so the day it closes is the one its last instant falls on.
        const anchor =
          mode === "right" ? newEndDate.subtract(1, "millisecond") : newStartDate;
        const snapped = calendar.snapForward(anchor);
        snapDays = snapped.diff(anchor, "day");

        // A left-edge resize must not snap past the bar's own end
        if (mode === "left" && snapped.valueOf() >= newEndDate.valueOf()) {
          snapDays = 0;
        }
      }

      if (snapDays) {
        const snapPx = pxBetweenDates(
          newStartDate,
          newStartDate.add(snapDays, "day"),
          selectedScale
        );
        if (mode !== "right") {
          newStartDate = newStartDate.add(snapDays, "day");
          offsetX += snapPx;
        }
        if (mode !== "left") {
          newEndDate = newEndDate.add(snapDays, "day");
        }
        if (mode === "left") offsetWidth -= snapPx;
        if (mode === "right") offsetWidth += snapPx;
      }

      if (mode === "bar") {
        if (boundedMembers.length) {
          // One shared delta, shrunk to the tightest member bound, keeps the subtree rigid
          const requestedMs =
            newStartDate.valueOf() - initialStartDate.valueOf();
          const deltaMs = clampMoveDelta(
            boundedMembers,
            requestedMs,
            selectedScale
          );
          moveDeltaMs = deltaMs;
          newStartDate = initialStartDate.add(deltaMs, "millisecond");
          newEndDate = initialEndDate.add(deltaMs, "millisecond");
        }
      } else if (bounds) {
        // Resizes only ever touch the dragged bar, so its own bounds are enough
        clamped = clampDragDates(
          mode,
          newStartDate,
          newEndDate,
          bounds,
          selectedScale
        );
        newStartDate = clamped.startDate;
        newEndDate = clamped.endDate;
      }

      // Offsets come from the clamped dates, not the raw steps, so the bar stops on the bound
      if (moveDeltaMs !== null || clamped) {
        const startPx = pxBetweenDates(
          initialStartDate,
          newStartDate,
          selectedScale
        );
        const endPx = pxBetweenDates(
          initialEndDate,
          newEndDate,
          selectedScale
        );
        offsetX = startPx;
        offsetWidth = endPx - startPx;
      }

      // A clamped resize reports exactly the bound to onTasksChange
      resizedEdge = mode === "left" ? newStartDate : newEndDate;

      const offsets: Record<string, GanttDragOffset> = {};
      for (const id of taskIds) {
        offsets[id] =
          id === task.id
            ? {
                offsetX,
                offsetWidth,
                offsetStartDate: newStartDate,
                offsetEndDate: newEndDate,
              }
            : { offsetX, offsetWidth: 0 };
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
    const undoAutoScroll = () => {
      if (!scrollEl || !autoScrollPx) return;

      scrollEl.scrollBy({ left: -autoScrollPx, behavior: scrollBehavior() });
      autoScrollPx = 0;
    };

    const runAutoScroll = () => {
      autoScrollFrame = null;
      if (!scrollEl || velocity === 0) return;

      const before = scrollEl.scrollLeft;
      scrollEl.scrollLeft = before + velocity;
      const moved = scrollEl.scrollLeft - before;

      // Nothing moved means the range ends here - keep the loop alive so it resumes if it extends
      if (moved !== 0) {
        autoScrollPx += moved;
        applyMove();
      }

      autoScrollFrame = requestAnimationFrame(runAutoScroll);
    };

    const updateAutoScroll = (clientX: number) => {
      if (optionsRef.current.autoScroll === false || !scrollEl) return;

      const { left, right } = timelineEdges(scrollEl);
      velocity = edgeScrollVelocity(clientX, left, right);

      if (velocity === 0) {
        stopAutoScroll();
      } else if (autoScrollFrame === null) {
        autoScrollFrame = requestAnimationFrame(runAutoScroll);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      lastClientX = moveEvent.clientX;
      updateAutoScroll(moveEvent.clientX);
      applyMove();
    };

    const detachListeners = () => {
      stopAutoScroll();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      releaseTouchScroll?.();
      cleanupRef.current = null;
    };

    const endDrag = () => {
      undoAutoScroll();
      draggingRef.current = false;
      storeApi.getState().setBarDrag(null);
      storeApi.getState().clearDragOffsets(taskIds);
    };

    // A cancelled gesture (scroll takeover, multi-touch) reverts instead of committing
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;

      detachListeners();
      endDrag();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      detachListeners();

      if (dragSteps === 0) {
        endDrag();
        return;
      }

      // A clamped move commits the shared delta; unclamped, the step shift plus the calendar snap
      const shiftDate = (date: string) => {
        // A date that does not parse, like a summary's placeholder, is written back as it was.
        if (!dayjs(date).isValid()) return date;
        return moveDeltaMs !== null
          ? dayjs(date).add(moveDeltaMs, "millisecond").toISOString()
          : shiftByDragSteps(dayjs(date), dragSteps, selectedScale)
              .add(snapDays, "day")
              .toISOString();
      };

      // Ended before the commit, so a throw below cannot leave the bar stuck mid-drag.
      draggingRef.current = false;
      storeApi.getState().setBarDrag(null);

      // However many tasks moved, there is one updated array - onTasksChange fires once
      const draggedTasks = storeApi.getState().rawTasks.map((t) => {
        if (!movingIds.has(t.id)) return t;

        switch (mode) {
          case "bar":
            return {
              ...t,
              startDate: shiftDate(t.startDate),
              endDate: shiftDate(t.endDate),
            };

          case "left":
            return {
              ...t,
              startDate: resizedEdge.toISOString(),
            };

          case "right":
            return {
              ...t,
              endDate: resizedEdge.toISOString(),
            };
        }
      });

      // Clearing dragOffsets here flicks the bar back a frame; useGanttTimelineSync's recompute effect clears them
      storeApi.getState().setRawTasks(draggedTasks);
      optionsRef.current.onTasksChange?.(draggedTasks);
    };

    // A chart unmounted mid-drag drops the drag rather than commit it from its release
    cleanupRef.current = () => {
      detachListeners();
      endDrag();
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
    consumeDragClick,
  };
}
