import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useRef } from 'react';
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
}

export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) {
  const setCurrentTask = useGanttStore((store) => store.setCurrentTask);
  const rawTasks = useGanttStore((store) => store.rawTasks);
  const scale = useGanttStore((store) => store.selectedScale);
  const setDragOffset = useGanttStore((store) => store.setDragOffset);
  const clearDragOffset = useGanttStore((store) => store.clearDragOffset);
  const setRawTasks = useGanttStore((store) => store.setRawTasks);

  const dragContextRef = useRef<DragContext | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
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
    };

    setCurrentTask(task);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    const ctx = dragContextRef.current;
    if (!ctx) return;

    const { basePxPerDragStep } = GANTT_SCALE_CONFIG[scale];
    const scaleConfig = GANTT_SCALE_CONFIG[scale];
    const minutesPerPixel =
      (scaleConfig.dragStepAmount *
        {
          minute: 1,
          hour: 60,
          day: 60 * 24,
          week: 60 * 24 * 7,
          month: 60 * 24 * 30,
        }[scaleConfig.dragStepUnit]) /
      scaleConfig.basePxPerDragStep;

    const minimumWidth = basePxPerDragStep;

    let deltaX = e.clientX - ctx.initialClientX;

    if (ctx.mode === 'left') {
      deltaX = Math.min(deltaX, ctx.initialWidth - minimumWidth);
      if (deltaX < 0) {
        deltaX = Math.floor(deltaX / basePxPerDragStep) * basePxPerDragStep;
      }
    } else if (ctx.mode === 'right') {
      deltaX = Math.max(deltaX, -ctx.initialWidth + minimumWidth);
      if (deltaX > 0) {
        deltaX = Math.ceil(deltaX / basePxPerDragStep) * basePxPerDragStep;
      }
    }

    const steps = Math.round(deltaX / basePxPerDragStep);
    if (steps === ctx.dragSteps) return;

    ctx.dragSteps = steps;

    const draggedPx = ctx.dragSteps * basePxPerDragStep;
    const totalDraggedMinutes = draggedPx * minutesPerPixel;

    // on move update the offset start date and end date with updated values
    let offsetStartDate = dayjs(ctx.initialStartDate);
    let offsetEndDate = dayjs(ctx.initialEndDate);
    
    if (ctx.mode === 'bar') {
      offsetStartDate = offsetStartDate.add(totalDraggedMinutes, 'minute');
      offsetEndDate = offsetEndDate.add(totalDraggedMinutes, 'minute');
    } else if (ctx.mode === 'left') {
      offsetStartDate = offsetStartDate.add(totalDraggedMinutes, 'minute');
      // endDate stays the same
    } else if (ctx.mode === 'right') {
      offsetEndDate = offsetEndDate.add(totalDraggedMinutes, 'minute');
      // startDate stays the same
    }
    
    
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
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    const ctx = dragContextRef.current;
    if (!ctx) return;

    const { dragStepAmount, dragStepUnit } = GANTT_SCALE_CONFIG[scale];

    const adjustDate = (date: string) =>
      dayjs(date)
        .add(
          ctx.dragSteps * dragStepAmount,
          dragStepUnit as dayjs.ManipulateType,
        )
        .toISOString();

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

    const pointerId = activePointerIdRef.current;
    if (pointerId !== null) {
      document
        .getElementById(`task-${task.id}`)
        ?.releasePointerCapture(pointerId);
    }

    activePointerIdRef.current = null;
    dragContextRef.current = null;
  };

  return { onPointerDown };
}
