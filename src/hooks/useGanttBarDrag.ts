import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useRef, useCallback } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttDragOffset } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';

export type DragMode = 'bar' | 'left' | 'right';

interface DragContext {
  mode: DragMode;
  initialClientX: number;
  initialLeft: number;
  initialWidth: number;
  initialStartDate: string;
  initialEndDate: string;
  dragSteps: number;
  basePxPerDragStep: number;
  minutesPerPixel: number;
  minimumWidth: number;
}

export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) {
  const setCurrentTask = useGanttStore((state) => state.setCurrentTask);
  const rawTasks = useGanttStore((state) => state.rawTasks);
  const scale = useGanttStore((state) => state.selectedScale);
  const setDragOffset = useGanttStore((state) => state.setDragOffset);
  const clearDragOffset = useGanttStore((state) => state.clearDragOffset);
  const setRawTasks = useGanttStore((state) => state.setRawTasks);

  const dragContextRef = useRef<DragContext | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Pre-calculate scale configuration to avoid repeated lookups
  const scaleConfig = GANTT_SCALE_CONFIG[scale];
  const basePxPerDragStep = scaleConfig.basePxPerDragStep;
  const minutesPerPixel = (scaleConfig.dragStepAmount * {
    minute: 1,
    hour: 60,
    day: 60 * 24,
    week: 60 * 24 * 7,
    month: 60 * 24 * 30,
  }[scaleConfig.dragStepUnit]) / basePxPerDragStep;

  const onPointerMove = useCallback((e: PointerEvent) => {
    const ctx = dragContextRef.current;
    if (!ctx) return;

    let deltaX = e.clientX - ctx.initialClientX;

    // Apply constraints based on drag mode
    if (ctx.mode === 'left') {
      deltaX = Math.min(deltaX, ctx.initialWidth - ctx.minimumWidth);
      if (deltaX < 0) {
        deltaX = Math.floor(deltaX / ctx.basePxPerDragStep) * ctx.basePxPerDragStep;
      }
    } else if (ctx.mode === 'right') {
      deltaX = Math.max(deltaX, -ctx.initialWidth + ctx.minimumWidth);
      if (deltaX > 0) {
        deltaX = Math.ceil(deltaX / ctx.basePxPerDragStep) * ctx.basePxPerDragStep;
      }
    }

    const steps = Math.round(deltaX / ctx.basePxPerDragStep);
    if (steps === ctx.dragSteps) return;

    ctx.dragSteps = steps;

    const draggedPx = ctx.dragSteps * ctx.basePxPerDragStep;
    const totalDraggedMinutes = draggedPx * ctx.minutesPerPixel;

    // Calculate offset dates
    let offsetStartDate = dayjs(ctx.initialStartDate);
    let offsetEndDate = dayjs(ctx.initialEndDate);
    
    if (ctx.mode === 'bar') {
      offsetStartDate = offsetStartDate.add(totalDraggedMinutes, 'minute');
      offsetEndDate = offsetEndDate.add(totalDraggedMinutes, 'minute');
    } else if (ctx.mode === 'left') {
      offsetStartDate = offsetStartDate.add(totalDraggedMinutes, 'minute');
    } else if (ctx.mode === 'right') {
      offsetEndDate = offsetEndDate.add(totalDraggedMinutes, 'minute');
    }
    
    // Create offset object
    const offset: GanttDragOffset =
      ctx.mode === 'bar'
        ? { offsetX: draggedPx, offsetWidth: 0, offsetStartDate, offsetEndDate }
        : ctx.mode === 'left'
        ? {
            offsetX: draggedPx,
            offsetWidth: -draggedPx,
            offsetStartDate,
            offsetEndDate,
          }
        : {
            offsetX: 0,
            offsetWidth: draggedPx,
            offsetStartDate,
            offsetEndDate,
          };

    setDragOffset(task.id, offset);
  }, [task.id, setDragOffset]);

  const onPointerUp = useCallback(() => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    const ctx = dragContextRef.current;
    if (!ctx) return;

    const { dragStepAmount, dragStepUnit } = scaleConfig;

    const adjustDate = (date: string) =>
      dayjs(date)
        .add(
          ctx.dragSteps * dragStepAmount,
          dragStepUnit as dayjs.ManipulateType,
        )
        .toISOString();

    // Update tasks based on drag mode
    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      switch (ctx.mode) {
        case 'bar':
          return {
            ...t,
            startDate: adjustDate(ctx.initialStartDate),
            endDate: adjustDate(ctx.initialEndDate),
          } as Task;
        case 'left':
          return {
            ...t,
            startDate: adjustDate(ctx.initialStartDate),
          } as Task;
        default:
          return {
            ...t,
            endDate: adjustDate(ctx.initialEndDate),
          } as Task;
      }
    });

    setCurrentTask(null);
    clearDragOffset(task.id);
    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);

    // Cleanup pointer capture
    const pointerId = activePointerIdRef.current;
    if (pointerId !== null) {
      document
        .getElementById(`task-${task.id}`)
        ?.releasePointerCapture(pointerId);
    }

    activePointerIdRef.current = null;
    dragContextRef.current = null;
  }, [task.id, rawTasks, scaleConfig, setCurrentTask, clearDragOffset, setRawTasks, onTasksChange, onPointerMove]);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = useCallback((e) => {
    const target = e.target as HTMLElement;
    const mode: DragMode = target.closest('[data-mode="left"]')
      ? 'left'
      : target.closest('[data-mode="right"]')
        ? 'right'
        : 'bar';

    dragContextRef.current = {
      mode,
      initialClientX: e.clientX,
      initialLeft: task.barLeft,
      initialWidth: task.barWidth,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      dragSteps: 0,
      basePxPerDragStep,
      minutesPerPixel,
      minimumWidth: basePxPerDragStep,
    };

    setCurrentTask(task);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }, [task, basePxPerDragStep, minutesPerPixel, setCurrentTask, onPointerMove, onPointerUp]);

  return { onPointerDown };
}