import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';

function getIntegerStep(offsetX: number, scaleKey: GanttScaleKey) {
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[scaleKey];
  return Math.floor(offsetX / basePxPerDragStep);
}

// FULL BAR DRAG
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

  // track initial mouseX and last step we applied
  const startXRef = useRef<number | null>(null);
  const lastStepRef = useRef<number>(0);

  const onDragStart = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    lastStepRef.current = 0;
    setDraggingTaskMeta({ taskId: task.id, type: 'bar' });

    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const offsetX = e.clientX - startXRef.current;
    const currentStep = getIntegerStep(offsetX, selectedScale);
    if (currentStep === lastStepRef.current) return;

    // stepDelta tells us how many steps we've moved since last time
    const stepDelta = currentStep - lastStepRef.current;
    lastStepRef.current = currentStep;

    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];

    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      return {
        ...t,
        startDate: dayjs(t.startDate)
          .add(stepDelta * dragStepAmount, dragStepUnit)
          .toISOString(),
        endDate: dayjs(t.endDate)
          .add(stepDelta * dragStepAmount, dragStepUnit)
          .toISOString(),
      };
    });

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);
    clearDraggingTaskMeta();

    // reset
    startXRef.current = null;
    lastStepRef.current = 0;

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }
  };

  return { onDragStart };
};

// LEFT HANDLE
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
  const lastStepRef = useRef<number>(0);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    lastStepRef.current = 0;
    setDraggingTaskMeta({ taskId: task.id, type: 'left' });

    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const offsetX = e.clientX - startXRef.current;
    const currentStep = getIntegerStep(offsetX, selectedScale);
    if (currentStep === lastStepRef.current) return;

    const stepDelta = currentStep - lastStepRef.current;
    lastStepRef.current = currentStep;

    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];
    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      const newStart = dayjs(t.startDate).add(
        stepDelta * dragStepAmount,
        dragStepUnit,
      );
      if (newStart.isAfter(dayjs(t.endDate))) return t; // keep valid

      return { ...t, startDate: newStart.toISOString() };
    });

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);
    clearDraggingTaskMeta();
    startXRef.current = null;
    lastStepRef.current = 0;

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }
  };

  return { onDragStart };
};

// RIGHT HANDLE
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
  const lastStepRef = useRef<number>(0);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    lastStepRef.current = 0;
    setDraggingTaskMeta({ taskId: task.id, type: 'right' });

    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const offsetX = e.clientX - startXRef.current;
    const currentStep = getIntegerStep(offsetX, selectedScale);
    if (currentStep === lastStepRef.current) return;

    const stepDelta = currentStep - lastStepRef.current;
    lastStepRef.current = currentStep;

    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];
    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      const newEnd = dayjs(t.endDate).add(
        stepDelta * dragStepAmount,
        dragStepUnit,
      );
      if (newEnd.isBefore(dayjs(t.startDate))) return t; // keep valid

      return { ...t, endDate: newEnd.toISOString() };
    });

    setRawTasks(updatedTasks);
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);
    clearDraggingTaskMeta();
    startXRef.current = null;
    lastStepRef.current = 0;

    if (onTasksChange) {
      onTasksChange(useGanttStore.getState().rawTasks);
    }
  };

  return { onDragStart };
};
