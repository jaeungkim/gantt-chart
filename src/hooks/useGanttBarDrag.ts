import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';

export function calculateNewDateFromOffset(
  date: dayjs.Dayjs,
  offsetX: number,
  scaleKey: GanttScaleKey,
): dayjs.Dayjs {
  const { dragStepUnit, dragStepAmount, basePxPerDragStep } =
    GANTT_SCALE_CONFIG[scaleKey];

  const steps = Math.round(offsetX / basePxPerDragStep);
  return date.add(steps * dragStepAmount, dragStepUnit);
}
////////////////////////////////////////
// Full Bar Drag Hook
////////////////////////////////////////
export const useGanttBarDrag = (
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) => {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
  } = useGanttStore();

  const startXRef = useRef<number | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
    setDraggingTaskMeta({ taskId: task.id, type: 'bar' });
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;
    const offsetX = e.clientX - startXRef.current;

    const newStart = calculateNewDateFromOffset(
      dayjs(task.startDate),
      offsetX,
      selectedScale,
    );

    const newEnd = calculateNewDateFromOffset(
      dayjs(task.endDate),
      offsetX,
      selectedScale,
    );

    const updatedTasks = rawTasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            startDate: newStart.toISOString(),
            endDate: newEnd.toISOString(),
          }
        : t,
    );

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }

    clearDraggingTaskMeta();
  };

  return { onDragStart };
};

////////////////////////////////////////
// Left Handle Drag Hook
////////////////////////////////////////
export const useGanttBarLeftHandleDrag = (
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) => {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
  } = useGanttStore();

  const startXRef = useRef<number | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
    setDraggingTaskMeta({ taskId: task.id, type: 'left' });
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;
    const offsetX = e.clientX - startXRef.current;

    const newStart = calculateNewDateFromOffset(
      dayjs(task.startDate),
      offsetX,
      selectedScale,
    );
    if (newStart.isAfter(dayjs(task.endDate))) return;

    const updatedTasks = rawTasks.map((t) =>
      t.id === task.id ? { ...t, startDate: newStart.toISOString() } : t,
    );

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }

    clearDraggingTaskMeta();
  };

  return { onDragStart };
};

////////////////////////////////////////
// Right Handle Drag Hook
////////////////////////////////////////
export const useGanttBarRightHandleDrag = (
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) => {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
  } = useGanttStore();

  const startXRef = useRef<number | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
    setDraggingTaskMeta({ taskId: task.id, type: 'right' });
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;
    const offsetX = e.clientX - startXRef.current;

    const newEnd = calculateNewDateFromOffset(
      dayjs(task.endDate),
      offsetX,
      selectedScale,
    );
    if (newEnd.isBefore(dayjs(task.startDate))) return;

    const updatedTasks = rawTasks.map((t) =>
      t.id === task.id ? { ...t, endDate: newEnd.toISOString() } : t,
    );

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }

    clearDraggingTaskMeta();
  };

  return { onDragStart };
};
