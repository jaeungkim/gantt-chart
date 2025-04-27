import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useEffect, useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';

const steps = (px: number, scale: GanttScaleKey) =>
  Math.round(px / GANTT_SCALE_CONFIG[scale].basePxPerDragStep);

type Mode = 'bar' | 'left' | 'right';
interface Drag {
  mode: Mode;
  startX: number;
  left0: number;
  width0: number;
  startDate0: string;
  endDate0: string;
  delta: number;
  frame?: number;
}

export function useGanttBarDrag(
  ref: React.RefObject<HTMLDivElement>,
  task: TaskTransformed,
  onTasksChange?: (t: Task[]) => void,
) {
  const rawTasks = useGanttStore((s) => s.rawTasks);
  const selectedScale = useGanttStore((s) => s.selectedScale);
  const setRawTasks = useGanttStore((s) => s.setRawTasks);

  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      let mode: Mode = 'bar';
      const tgt = e.target as HTMLElement;
      if (tgt.closest('[data-mode="left"]')) mode = 'left';
      if (tgt.closest('[data-mode="right"]')) mode = 'right';

      drag.current = {
        mode,
        startX: e.clientX,
        left0: task.barLeft,
        width0: task.barWidth,
        startDate0: task.startDate,
        endDate0: task.endDate,
        delta: 0,
      };

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
    };

    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [task.barLeft, task.barWidth]);

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;

    const next = steps(e.clientX - d.startX, selectedScale);
    const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];
    const px = next * basePxPerDragStep;

    // 🛑 PREVENT drag if width would become invalid
    if (d.mode === 'left' && d.width0 - px < 1) return;
    if (d.mode === 'right' && d.width0 + px < 1) return;

    if (next === d.delta) return;
    d.delta = next;

    cancelAnimationFrame(d.frame!);
    d.frame = requestAnimationFrame(() => {
      if (!ref.current) return;

      const absX = d.left0 + px;

      if (d.mode === 'bar') {
        ref.current.style.transform = `translateX(${absX}px)`;
      } else if (d.mode === 'left') {
        const w = Math.max(1, d.width0 - px);
        ref.current.style.transform = `translateX(${absX}px)`;
        ref.current.style.width = `${w}px`;
      } else {
        const w = Math.max(1, d.width0 + px);
        ref.current.style.transform = `translateX(${d.left0}px)`;
        ref.current.style.width = `${w}px`;
      }
    });
  };

  const onUp = (e: PointerEvent) => {
    const el = ref.current;
    el?.removeEventListener('pointermove', onMove);
    el?.removeEventListener('pointerup', onUp);

    const d = drag.current;
    if (!d) return;
    drag.current = null;
    cancelAnimationFrame(d.frame!);

    const delta = steps(e.clientX - d.startX, selectedScale);

    if (delta === 0) {
      if (ref.current) ref.current.style.transform = '';
      return;
    }

    const { dragStepAmount, dragStepUnit } = GANTT_SCALE_CONFIG[selectedScale];

    const updated = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      switch (d.mode) {
        case 'bar':
          return {
            ...t,
            startDate: dayjs(d.startDate0)
              .add(delta * dragStepAmount, dragStepUnit)
              .toISOString(),
            endDate: dayjs(d.endDate0)
              .add(delta * dragStepAmount, dragStepUnit)
              .toISOString(),
          };

        case 'left': {
          const ns = dayjs(d.startDate0).add(
            delta * dragStepAmount,
            dragStepUnit,
          );
          return ns.isAfter(dayjs(t.endDate))
            ? t
            : { ...t, startDate: ns.toISOString() };
        }

        case 'right': {
          const ne = dayjs(d.endDate0).add(
            delta * dragStepAmount,
            dragStepUnit,
          );
          return ne.isBefore(dayjs(t.startDate))
            ? t
            : { ...t, endDate: ne.toISOString() };
        }
      }
    });

    setRawTasks(updated);
    onTasksChange?.(updated);
  };
}
