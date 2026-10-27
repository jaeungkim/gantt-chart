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

export function useGanttBarDrag(
  task: TaskTransformed,
  options: GanttBarDragOptions,
  interaction?: GanttInteractionConfig,
  calendar?: WorkingCalendar
) {
  const storeApi = useGanttStoreApi();
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pendingGestureRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useLatestRef(options);

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
    if (draggingRef.current) return;
    movedRef.current = false;
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const mode = detectDragMode(e);
    if (!mode) return;

    const element = e.currentTarget;
    const { pointerId, pointerType } = e;

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

    const rawTasks = storeApi.getState().rawTasks;
    const taskIds = task.isSummary
      ? collectSubtreeIds(rawTasks, task.id)
      : [task.id];
    const movingIds = new Set(taskIds);

    const bounds = toDragBounds(minDate, maxDate);
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
    let autoScrollPx = 0;
    let snapDays = 0;
    let moveDeltaMs: number | null = null;
    let clamped: { startDate: Dayjs; endDate: Dayjs } | null = null;
    let resizedEdge = mode === "left" ? initialStartDate : initialEndDate;

    storeApi.getState().setBarDrag({ task, mode });
    try {
      element.setPointerCapture(pointerId);
    } catch {}

    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const applyMove = () => {
      const deltaX = lastClientX - initialClientX + autoScrollPx;
      const rawSteps = Math.round(deltaX / basePxPerDragStep);

      const maxShrinkSteps = Math.floor(
        (task.barWidth - basePxPerDragStep) / basePxPerDragStep
      );
      let steps = rawSteps;
      if (mode === "left") steps = Math.min(rawSteps, maxShrinkSteps);
      if (mode === "right") steps = Math.max(rawSteps, -maxShrinkSteps);
      if (mode === "left" && initialStartDate !== taskStart) steps = Math.max(steps, 0);
      if (mode === "right" && initialEndDate !== taskEnd) steps = Math.min(steps, 0);

      if (steps === dragSteps) return;
      dragSteps = steps;
      movedRef.current = true;

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

      snapDays = 0;
      if (calendar?.skipsNonWorkingDays) {
        const anchor =
          mode === "right" ? newEndDate.subtract(1, "millisecond") : newStartDate;
        const snapped = dayjs(calendar.snapForward(anchor.toDate()));
        snapDays = snapped.diff(anchor, "day");

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

      const shiftDate = (date: string) => {
        if (!dayjs(date).isValid()) return date;
        return moveDeltaMs !== null
          ? dayjs(date).add(moveDeltaMs, "millisecond").toISOString()
          : shiftByDragSteps(dayjs(date), dragSteps, selectedScale)
              .add(snapDays, "day")
              .toISOString();
      };

      draggingRef.current = false;
      storeApi.getState().setBarDrag(null);

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

      storeApi.getState().setRawTasks(draggedTasks);
      optionsRef.current.onTasksChange?.(draggedTasks);
    };

    cleanupRef.current = () => {
      detachListeners();
      endDrag();
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

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
