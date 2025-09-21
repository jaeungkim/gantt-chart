import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useRef } from "react";
import { useGanttStore } from "stores/store";
import { GanttDragOffset } from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";

export type DragMode = "bar" | "left" | "right";

interface DragContext {
  mode: DragMode;
  initialClientX: number;
  initialStartDate: dayjs.Dayjs;
  initialEndDate: dayjs.Dayjs;
  dragSteps: number;
  basePxPerDragStep: number;
  minutesPerPixel: number;
  minimumWidth: number;
}

// Time unit multipliers for cleaner calculation
const TIME_UNIT_MULTIPLIERS = {
  minute: 1,
  hour: 60,
  day: 60 * 24,
  week: 60 * 24 * 7,
  month: 60 * 24 * 30,
} as const;

// Helper functions outside component to avoid dependency issues
const calculateDragConstraints = (
  deltaX: number,
  mode: DragMode,
  initialWidth: number,
  basePxPerDragStep: number
) => {
  if (mode === "left") {
    const maxDelta = initialWidth - basePxPerDragStep;
    return Math.min(deltaX, maxDelta);
  }
  if (mode === "right") {
    const minDelta = -initialWidth + basePxPerDragStep;
    return Math.max(deltaX, minDelta);
  }
  return deltaX;
};

const snapToGrid = (
  deltaX: number,
  mode: DragMode,
  basePxPerDragStep: number
) => {
  if (mode === "left" && deltaX < 0) {
    return Math.floor(deltaX / basePxPerDragStep) * basePxPerDragStep;
  }
  if (mode === "right" && deltaX > 0) {
    return Math.ceil(deltaX / basePxPerDragStep) * basePxPerDragStep;
  }
  return deltaX;
};

const createDragOffset = (
  mode: DragMode,
  draggedPx: number,
  offsetStartDate: dayjs.Dayjs,
  offsetEndDate: dayjs.Dayjs
): GanttDragOffset => {
  switch (mode) {
    case "bar":
      return {
        offsetStartDate,
        offsetEndDate,
        offsetX: draggedPx,
        offsetWidth: 0,
      };
    case "left":
      return {
        offsetStartDate,
        offsetEndDate,
        offsetX: draggedPx,
        offsetWidth: -draggedPx,
      };
    case "right":
      return {
        offsetStartDate,
        offsetEndDate,
        offsetX: 0,
        offsetWidth: draggedPx,
      };
    default:
      return { offsetStartDate, offsetEndDate, offsetX: 0, offsetWidth: 0 };
  }
};

const detectDragMode = (target: HTMLElement): DragMode => {
  if (target.closest('[data-mode="left"]')) return "left";
  if (target.closest('[data-mode="right"]')) return "right";
  return "bar";
};

export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const setCurrentTask = useGanttStore((state) => state.setCurrentTask);
  const rawTasks = useGanttStore((state) => state.rawTasks);
  const scale = useGanttStore((state) => state.selectedScale);
  const setDragOffset = useGanttStore((state) => state.setDragOffset);
  const clearDragOffset = useGanttStore((state) => state.clearDragOffset);
  const setRawTasks = useGanttStore((state) => state.setRawTasks);

  const dragContextRef = useRef<DragContext | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Get scale configuration once
  const scaleConfig = GANTT_SCALE_CONFIG[scale];
  const basePxPerDragStep = scaleConfig.basePxPerDragStep;
  const minutesPerPixel =
    (scaleConfig.dragStepAmount *
      TIME_UNIT_MULTIPLIERS[scaleConfig.dragStepUnit]) /
    basePxPerDragStep;

  const onPointerMove = (e: PointerEvent) => {
    const ctx = dragContextRef.current;
    if (!ctx) return;

    let deltaX = e.clientX - ctx.initialClientX;

    // Apply constraints and snap to grid
    deltaX = calculateDragConstraints(
      deltaX,
      ctx.mode,
      task.barWidth,
      basePxPerDragStep
    );
    deltaX = snapToGrid(deltaX, ctx.mode, basePxPerDragStep);

    const steps = Math.round(deltaX / ctx.basePxPerDragStep);
    if (steps === ctx.dragSteps) return;

    ctx.dragSteps = steps;
    const draggedPx = steps * ctx.basePxPerDragStep;
    const totalDraggedMinutes = draggedPx * ctx.minutesPerPixel;

    // Calculate new dates based on mode
    const offsetStartDate =
      ctx.mode === "right"
        ? ctx.initialStartDate
        : ctx.initialStartDate.add(totalDraggedMinutes, "minute");

    const offsetEndDate =
      ctx.mode === "left"
        ? ctx.initialEndDate
        : ctx.initialEndDate.add(totalDraggedMinutes, "minute");

    const offset = createDragOffset(
      ctx.mode,
      draggedPx,
      offsetStartDate,
      offsetEndDate
    );
    setDragOffset(task.id, offset);
  };

  const onPointerUp = () => {
    // Remove event listeners
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    const ctx = dragContextRef.current;
    if (!ctx) return;

    // Update tasks with new dates
    const { dragStepAmount, dragStepUnit } = scaleConfig;
    const adjustDate = (date: dayjs.Dayjs) =>
      date
        .add(
          ctx.dragSteps * dragStepAmount,
          dragStepUnit as dayjs.ManipulateType
        )
        .toISOString();

    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      switch (ctx.mode) {
        case "bar":
          return {
            ...t,
            startDate: adjustDate(dayjs(t.startDate)),
            endDate: adjustDate(dayjs(t.endDate)),
          };
        case "left":
          return {
            ...t,
            startDate: adjustDate(dayjs(t.startDate)),
          };
        case "right":
          return {
            ...t,
            endDate: adjustDate(dayjs(t.endDate)),
          };
        default:
          return t;
      }
    });

    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);

    // Cleanup
    const pointerId = activePointerIdRef.current;
    if (pointerId !== null) {
      document
        .getElementById(`task-${task.id}`)
        ?.releasePointerCapture(pointerId);
    }

    activePointerIdRef.current = null;
    dragContextRef.current = null;
    setCurrentTask(null);
    clearDragOffset(task.id);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement;
    const mode = detectDragMode(target);

    // Setup drag context
    dragContextRef.current = {
      mode,
      initialClientX: e.clientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      dragSteps: 0,
      basePxPerDragStep,
      minutesPerPixel,
      minimumWidth: basePxPerDragStep,
    };

    setCurrentTask(task);

    // Setup event listeners
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  };

  return { onPointerDown };
}
