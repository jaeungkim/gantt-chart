import { useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { setupTimelineGrids } from 'utils/timeline';

const TICK_WIDTH_PX = 16;

function calculateNewDateFromOffset(
  date: dayjs.Dayjs,
  offsetX: number,
  pixelsPerDay: number,
) {
  const daysToShift = Math.round(offsetX / pixelsPerDay);
  return date.add(daysToShift, 'day');
}

////////////////////////////////////////
// Full Bar Drag Hook
////////////////////////////////////////
// onTasksChange emits Task[] from rawTasks, not TaskTransformed[], so update signature.
export const useGanttBarDrag = (
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void,
) => {
  const {
    rawTasks,
    timelineGrids,
    setRawTasks,
    setTimelineGrids,
    setMinDate,
    setMaxDate,
    selectedScale,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
  } = useGanttStore();

  const startXRef = useRef<number | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);

    // setCurrentDraggingTaskId for styling
    setDraggingTaskMeta({ taskId: task.id, type: 'bar' });
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const offsetX = e.clientX - startXRef.current;
    const newStart = calculateNewDateFromOffset(
      dayjs(task.startDate),
      offsetX,
      TICK_WIDTH_PX,
    );
    const newEnd = calculateNewDateFromOffset(
      dayjs(task.endDate),
      offsetX,
      TICK_WIDTH_PX,
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

    // Emit only after drag ends
    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }

    // Optionally re-setup timeline if needed
    const taskRecord = Object.fromEntries(
      useGanttStore
        .getState()
        .rawTasks.map((t) => [
          t.id,
          { startDate: t.startDate, endDate: t.endDate },
        ]),
    );

    setupTimelineGrids(
      taskRecord,
      useGanttStore.getState().selectedScale,
      useGanttStore.getState().setMinDate,
      useGanttStore.getState().setMaxDate,
      useGanttStore.getState().setTimelineGrids,
    );

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
    timelineGrids,
    setRawTasks,
    setTimelineGrids,
    setMinDate,
    setMaxDate,
    selectedScale,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
  } = useGanttStore();
  const startXRef = useRef<number | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);

    // Set currentlyDraggingTaskId for styling
    setDraggingTaskMeta({ taskId: task.id, type: 'left' });
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const offsetX = e.clientX - startXRef.current;
    const newStart = calculateNewDateFromOffset(
      dayjs(task.startDate),
      offsetX,
      TICK_WIDTH_PX,
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

    // Emit only after drag ends
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
    timelineGrids,
    setRawTasks,
    setTimelineGrids,
    setMinDate,
    setMaxDate,
    selectedScale,
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
      TICK_WIDTH_PX,
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

    // Emit only after drag ends
    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }

    clearDraggingTaskMeta();
  };

  return { onDragStart };
};
