import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useEffect, useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';

const toDragSteps = (px: number, scale: GanttScaleKey) =>
  Math.round(px / GANTT_SCALE_CONFIG[scale].basePxPerDragStep);

type DragMode = 'bar' | 'left' | 'right';

interface DragData {
  mode: DragMode;
  startX: number;
  startLeft: number;
  startWidth: number;
  startDate: string;
  endDate: string;
  steps: number;
  frame?: number;
}

export function useGanttBarDrag(
  ref: React.RefObject<HTMLDivElement>,
  task: TaskTransformed,
  onTasksChange?: (tasks: Task[]) => void,
) {
  const rawTasks = useGanttStore((s) => s.rawTasks);
  const selectedScale = useGanttStore((s) => s.selectedScale);
  const setRawTasks = useGanttStore((s) => s.setRawTasks);

  const dragRef = useRef<DragData | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const mode: DragMode = target.closest('[data-mode="left"]')
        ? 'left'
        : target.closest('[data-mode="right"]')
          ? 'right'
          : 'bar';

      dragRef.current = {
        mode,
        startX: e.clientX,
        startLeft: task.barLeft,
        startWidth: task.barWidth,
        startDate: task.startDate,
        endDate: task.endDate,
        steps: 0,
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    return () => element.removeEventListener('pointerdown', handlePointerDown);
  }, [task.barLeft, task.barWidth, selectedScale]);

  const handlePointerMove = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];
    const minWidthPx = basePxPerDragStep;
    let deltaPx = e.clientX - drag.startX;

    if (drag.mode === 'left') {
      const limit = drag.startWidth - minWidthPx;
      if (deltaPx > limit) deltaPx = limit;
      if (deltaPx < 0)
        deltaPx = Math.floor(deltaPx / basePxPerDragStep) * basePxPerDragStep;
    } else if (drag.mode === 'right') {
      const limit = drag.startWidth - minWidthPx;
      if (-deltaPx > limit) deltaPx = -limit;
      if (deltaPx > 0)
        deltaPx = Math.ceil(deltaPx / basePxPerDragStep) * basePxPerDragStep;
    }

    const steps = toDragSteps(deltaPx, selectedScale);
    if (steps === drag.steps) return;
    drag.steps = steps;

    cancelAnimationFrame(drag.frame!);
    drag.frame = requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;

      const translateX = drag.startLeft + steps * basePxPerDragStep;

      if (drag.mode === 'bar') {
        node.style.transform = `translateX(${translateX}px)`;
      } else if (drag.mode === 'left') {
        node.style.transform = `translateX(${translateX}px)`;
        node.style.width = `${drag.startWidth - steps * basePxPerDragStep}px`;
      } else {
        node.style.transform = `translateX(${drag.startLeft}px)`;
        node.style.width = `${drag.startWidth + steps * basePxPerDragStep}px`;
      }
    });
  };

  const handlePointerUp = () => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerUp);

    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    cancelAnimationFrame(drag.frame!);

    const scaleConfig = GANTT_SCALE_CONFIG[selectedScale];

    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      if (drag.mode === 'bar') {
        return {
          ...t,
          startDate: dayjs(drag.startDate)
            .add(
              drag.steps * scaleConfig.dragStepAmount,
              scaleConfig.dragStepUnit,
            )
            .toISOString(),
          endDate: dayjs(drag.endDate)
            .add(
              drag.steps * scaleConfig.dragStepAmount,
              scaleConfig.dragStepUnit,
            )
            .toISOString(),
        };
      }

      if (drag.mode === 'left') {
        const newStart = dayjs(drag.startDate).add(
          drag.steps * scaleConfig.dragStepAmount,
          scaleConfig.dragStepUnit,
        );
        return { ...t, startDate: newStart.toISOString() };
      }

      const newEnd = dayjs(drag.endDate).add(
        drag.steps * scaleConfig.dragStepAmount,
        scaleConfig.dragStepUnit,
      );
      return { ...t, endDate: newEnd.toISOString() };
    });

    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);
  };
}
