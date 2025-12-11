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
  initialBarWidth: number;
  dragSteps: number;
  basePxPerDragStep: number;
  dragStepAmount: number;
  dragStepUnit: string;
  taskId: string;
}

// 시간 단위 변환 상수
const TIME_UNIT_MULTIPLIERS = {
  minute: 1,
  hour: 60,
  day: 60 * 24,
  week: 60 * 24 * 7,
  month: 60 * 24 * 30,
} as const;

// 엣지 감지 영역 (px)
const EDGE_THRESHOLD = 10;

/**
 * Gantt 바 드래그 기능을 제공하는 훅
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const dragContextRef = useRef<DragContext | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const onTasksChangeRef = useRef(onTasksChange);
  onTasksChangeRef.current = onTasksChange;

  const selectedScale = useGanttStore((s) => s.selectedScale);
  const scaleConfig = GANTT_SCALE_CONFIG[selectedScale];
  const { basePxPerDragStep, dragStepAmount, dragStepUnit } = scaleConfig;

  // 드래그 모드 감지
  const detectDragMode = (e: React.PointerEvent<HTMLDivElement>): DragMode => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;

    if (relativeX <= EDGE_THRESHOLD) return "left";
    if (relativeX >= rect.width - EDGE_THRESHOLD) return "right";
    return "bar";
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const mode = detectDragMode(e);
    dragModeRef.current = mode;

    dragContextRef.current = {
      mode,
      initialClientX: e.clientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      initialBarWidth: task.barWidth,
      dragSteps: 0,
      basePxPerDragStep,
      dragStepAmount,
      dragStepUnit,
      taskId: task.id,
    };

    useGanttStore.getState().setCurrentTask(task);
    e.currentTarget.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (!ctx) return;

      const deltaX = moveEvent.clientX - ctx.initialClientX;
      const steps = Math.round(deltaX / ctx.basePxPerDragStep);
      
      if (steps === ctx.dragSteps) return;
      ctx.dragSteps = steps;

      const draggedPx = steps * ctx.basePxPerDragStep;
      const minutesPerStep = ctx.dragStepAmount * TIME_UNIT_MULTIPLIERS[ctx.dragStepUnit as keyof typeof TIME_UNIT_MULTIPLIERS];
      const totalMinutes = steps * minutesPerStep;

      let newStartDate: dayjs.Dayjs;
      let newEndDate: dayjs.Dayjs;
      let offsetX = 0;
      let offsetWidth = 0;

      switch (ctx.mode) {
        case "bar":
          newStartDate = ctx.initialStartDate.add(totalMinutes, "minute");
          newEndDate = ctx.initialEndDate.add(totalMinutes, "minute");
          offsetX = draggedPx;
          offsetWidth = 0;
          break;

        case "left":
          newStartDate = ctx.initialStartDate.add(totalMinutes, "minute");
          newEndDate = ctx.initialEndDate;
          offsetX = draggedPx;
          offsetWidth = -draggedPx;
          
          if (ctx.initialBarWidth + offsetWidth < ctx.basePxPerDragStep) {
            return;
          }
          break;

        case "right":
          newStartDate = ctx.initialStartDate;
          newEndDate = ctx.initialEndDate.add(totalMinutes, "minute");
          offsetX = 0;
          offsetWidth = draggedPx;
          
          if (ctx.initialBarWidth + offsetWidth < ctx.basePxPerDragStep) {
            return;
          }
          break;

        default:
          return;
      }

      const offset: GanttDragOffset = {
        offsetX,
        offsetWidth,
        offsetStartDate: newStartDate,
        offsetEndDate: newEndDate,
      };

      useGanttStore.getState().setDragOffset(ctx.taskId, offset);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);

      const ctx = dragContextRef.current;
      if (!ctx) {
        return;
      }

      if (ctx.dragSteps === 0) {
        dragContextRef.current = null;
        dragModeRef.current = null;
        useGanttStore.getState().setCurrentTask(null);
        useGanttStore.getState().clearDragOffset(ctx.taskId);
        return;
      }

      const currentRawTasks = useGanttStore.getState().rawTasks;
      const minutesPerStep = ctx.dragStepAmount * TIME_UNIT_MULTIPLIERS[ctx.dragStepUnit as keyof typeof TIME_UNIT_MULTIPLIERS];
      const totalMinutes = ctx.dragSteps * minutesPerStep;

      const updatedTasks = currentRawTasks.map((t) => {
        if (t.id !== ctx.taskId) return t;

        switch (ctx.mode) {
          case "bar":
            return {
              ...t,
              startDate: dayjs(t.startDate).add(totalMinutes, "minute").toISOString(),
              endDate: dayjs(t.endDate).add(totalMinutes, "minute").toISOString(),
            };

          case "left":
            return {
              ...t,
              startDate: dayjs(t.startDate).add(totalMinutes, "minute").toISOString(),
            };

          case "right":
            return {
              ...t,
              endDate: dayjs(t.endDate).add(totalMinutes, "minute").toISOString(),
            };

          default:
            return t;
        }
      });

      useGanttStore.getState().setRawTasks(updatedTasks);
      onTasksChangeRef.current?.(updatedTasks);

      dragContextRef.current = null;
      dragModeRef.current = null;
      useGanttStore.getState().setCurrentTask(null);
      useGanttStore.getState().clearDragOffset(ctx.taskId);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  return { 
    onPointerDown, 
    dragMode: dragModeRef.current 
  };
}
