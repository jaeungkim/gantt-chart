import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useRef, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { setupTimelineStructure } from 'utils/timeline';

function getStepsFromOffset(offsetX: number, scaleKey: GanttScaleKey): number {
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[scaleKey];
  return Math.round(offsetX / basePxPerDragStep);
}

// === FULL BAR DRAG ===
export function useGanttBarDrag(
  task: TaskTransformed,
  barLeft: number,
  onTasksChange?: (updatedTasks: Task[]) => void,
) {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
    setBottomRowCells,
    setTopHeaderGroups,
    setDraggingBarDateRange,
  } = useGanttStore();

  const [tempLeft, setTempLeft] = useState(barLeft);
  const tempLeftRef = useRef(barLeft);
  const startXRef = useRef<number | null>(null);
  const originalLeftRef = useRef(barLeft);
  const initialStartDateRef = useRef(task.startDate);
  const initialEndDateRef = useRef(task.endDate);

  const onDragStart = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    originalLeftRef.current = barLeft;
    initialStartDateRef.current = task.startDate;
    initialEndDateRef.current = task.endDate;
    setTempLeft(barLeft);
    tempLeftRef.current = barLeft;

    setDraggingTaskMeta({ taskId: task.id, type: 'bar' });
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;
    const rawOffsetX = e.clientX - startXRef.current;
    const stepDelta = getStepsFromOffset(rawOffsetX, selectedScale);
    const steppedOffsetPx =
      stepDelta * GANTT_SCALE_CONFIG[selectedScale].basePxPerDragStep;

    // calculate new start date (left) when we drag the bar
    const newStartDate = dayjs(initialStartDateRef.current).add(
      stepDelta * GANTT_SCALE_CONFIG[selectedScale].dragStepAmount,
      GANTT_SCALE_CONFIG[selectedScale].dragStepUnit,
    );

    // calculate the new end date (right) when we drag the bar
    const newEndDate = dayjs(initialEndDateRef.current).add(
      stepDelta * GANTT_SCALE_CONFIG[selectedScale].dragStepAmount,
      GANTT_SCALE_CONFIG[selectedScale].dragStepUnit,
    );

    console.log('newEndDate', newEndDate);
    
    const newLeft = originalLeftRef.current + steppedOffsetPx;
    setDraggingBarDateRange({
      startDate: newStartDate.toISOString(),
      endDate: newEndDate.toISOString(),
      barLeft: task.barLeft + steppedOffsetPx,
      barWidth: task.barWidth,
    });
    setTempLeft(newLeft);
    tempLeftRef.current = newLeft;
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    const finalOffset = tempLeftRef.current - originalLeftRef.current;
    const stepDelta = getStepsFromOffset(finalOffset, selectedScale);
    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];

    const updatedTasks = rawTasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            startDate: dayjs(initialStartDateRef.current)
              .add(stepDelta * dragStepAmount, dragStepUnit)
              .toISOString(),
            endDate: dayjs(initialEndDateRef.current)
              .add(stepDelta * dragStepAmount, dragStepUnit)
              .toISOString(),
          }
        : t,
    );

    // update timeline structure
    setupTimelineStructure(
      Object.fromEntries(
        updatedTasks.map((t) => [
          t.id,
          { startDate: t.startDate, endDate: t.endDate },
        ]),
      ),
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
    );
    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);

    clearDraggingTaskMeta();
    startXRef.current = null;
  };

  return { onDragStart, tempLeft };
}

// === LEFT HANDLE ===
export function useGanttBarLeftHandleDrag(
  task: TaskTransformed,
  barLeft: number,
  barWidth: number,
  onTasksChange?: (updatedTasks: Task[]) => void,
) {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
    setBottomRowCells,
    setTopHeaderGroups,
  } = useGanttStore();

  const [tempLeft, setTempLeft] = useState(barLeft);
  const [tempWidth, setTempWidth] = useState(barWidth);
  const tempLeftRef = useRef(barLeft);
  const tempWidthRef = useRef(barWidth);

  const startXRef = useRef<number | null>(null);
  const originalLeftRef = useRef(barLeft);
  const originalWidthRef = useRef(barWidth);
  const initialStartDateRef = useRef(task.startDate);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    originalLeftRef.current = barLeft;
    originalWidthRef.current = barWidth;
    initialStartDateRef.current = task.startDate;

    setTempLeft(barLeft);
    setTempWidth(barWidth);
    tempLeftRef.current = barLeft;
    tempWidthRef.current = barWidth;

    setDraggingTaskMeta({ taskId: task.id, type: 'left' });
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current == null) return;

    const rawOffsetX = e.clientX - startXRef.current;
    const stepDelta = getStepsFromOffset(rawOffsetX, selectedScale);
    const steppedOffsetPx =
      stepDelta * GANTT_SCALE_CONFIG[selectedScale].basePxPerDragStep;

    const newLeft = originalLeftRef.current + steppedOffsetPx;
    const newWidth = originalWidthRef.current - steppedOffsetPx;

    if (newWidth < 1) return;

    setTempLeft(newLeft);
    setTempWidth(newWidth);
    tempLeftRef.current = newLeft;
    tempWidthRef.current = newWidth;
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    const finalOffset = tempLeftRef.current - originalLeftRef.current;
    const stepDelta = getStepsFromOffset(finalOffset, selectedScale);
    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];

    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      const newStart = dayjs(initialStartDateRef.current).add(
        stepDelta * dragStepAmount,
        dragStepUnit,
      );
      if (newStart.isAfter(dayjs(t.endDate))) return t;
      return { ...t, startDate: newStart.toISOString() };
    });

    setRawTasks(updatedTasks);
    setupTimelineStructure(
      Object.fromEntries(
        updatedTasks.map((t) => [
          t.id,
          { startDate: t.startDate, endDate: t.endDate },
        ]),
      ),
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
    );
    onTasksChange?.(updatedTasks);
    clearDraggingTaskMeta();
    startXRef.current = null;
  };

  return { onDragStart, tempLeft, tempWidth };
}

// === RIGHT HANDLE ===
export function useGanttBarRightHandleDrag(
  task: TaskTransformed,
  barWidth: number,
  onTasksChange?: (updatedTasks: Task[]) => void,
) {
  const {
    rawTasks,
    selectedScale,
    setRawTasks,
    setDraggingTaskMeta,
    clearDraggingTaskMeta,
    setBottomRowCells,
    setTopHeaderGroups,
  } = useGanttStore();

  const [tempWidth, setTempWidth] = useState(barWidth);
  const tempWidthRef = useRef(barWidth);

  const startXRef = useRef<number | null>(null);
  const originalWidthRef = useRef(barWidth);
  const initialEndDateRef = useRef(task.endDate);

  const onDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startXRef.current = e.clientX;
    originalWidthRef.current = barWidth;
    initialEndDateRef.current = task.endDate;

    setTempWidth(barWidth);
    tempWidthRef.current = barWidth;

    setDraggingTaskMeta({ taskId: task.id, type: 'right' });
    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', onDragEnd);
  };

  const onDragging = (e: MouseEvent) => {
    if (startXRef.current === null) return;

    const rawOffsetX = e.clientX - startXRef.current;
    const stepDelta = getStepsFromOffset(rawOffsetX, selectedScale);
    const steppedOffsetPx =
      stepDelta * GANTT_SCALE_CONFIG[selectedScale].basePxPerDragStep;

    const newWidth = originalWidthRef.current + steppedOffsetPx;
    if (newWidth < 1) return;

    console.log('newWidth', newWidth);
    setTempWidth(newWidth);
    tempWidthRef.current = newWidth;
  };

  const onDragEnd = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', onDragEnd);

    const finalOffset = tempWidthRef.current - originalWidthRef.current;
    const stepDelta = getStepsFromOffset(finalOffset, selectedScale);
    const { dragStepUnit, dragStepAmount } = GANTT_SCALE_CONFIG[selectedScale];

    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      const newEnd = dayjs(initialEndDateRef.current).add(
        stepDelta * dragStepAmount,
        dragStepUnit,
      );
      if (newEnd.isBefore(dayjs(t.startDate))) return t;
      return { ...t, endDate: newEnd.toISOString() };
    });

    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);

    // update timeline structure
    setupTimelineStructure(
      Object.fromEntries(
        updatedTasks.map((t) => [
          t.id,
          { startDate: t.startDate, endDate: t.endDate },
        ]),
      ),
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
    );
    clearDraggingTaskMeta();
    startXRef.current = null;
  };

  return { onDragStart, tempWidth };
}
