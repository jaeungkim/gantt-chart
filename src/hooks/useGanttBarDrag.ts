import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { useEffect, useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task, TaskTransformed } from 'types/task';
import dayjs from 'utils/dayjs';
import { setupTimelineStructure } from 'utils/timeline';

/* helpers */
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

/* main hook */
export function useGanttBarDrag(
  ref: React.RefObject<HTMLDivElement>,
  task: TaskTransformed,
  onTasksChange?: (t: Task[]) => void,
) {
  const rawTasks = useGanttStore((s) => s.rawTasks);
  const selectedScale = useGanttStore((s) => s.selectedScale);
  const setRawTasks = useGanttStore((s) => s.setRawTasks);
  const setBottomRowCells = useGanttStore((s) => s.setBottomRowCells);
  const setTopHeaderGroups = useGanttStore((s) => s.setTopHeaderGroups);

  const drag = useRef<Drag | null>(null);

  /* pointerdown ---------------------------------------------------------- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      /* Which part? */
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

      /* capture this pointer so events keep coming even outside element */
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
    };

    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [task.barLeft, task.barWidth]);

  /* pointermove ----------------------------------------------------------- */
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;

    const next = steps(e.clientX - d.startX, selectedScale);
    if (next === d.delta) return;
    d.delta = next;

    const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];
    const px = d.delta * basePxPerDragStep;

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

  /* pointerup ------------------------------------------------------------- */
  const onUp = (e: PointerEvent) => {
    const el = ref.current;
    el?.removeEventListener('pointermove', onMove);
    el?.removeEventListener('pointerup', onUp);

    const d = drag.current;
    if (!d) return;
    drag.current = null;
    cancelAnimationFrame(d.frame!);

    /* compute final step from actual pointer position */
    const delta = steps(e.clientX - d.startX, selectedScale);

    console.log('delta', delta);
    if (delta === 0) {
      /* clear the preview styles we applied during the drag */
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

    /* commit & rebuild timeline */
    setRawTasks(updated);
    onTasksChange?.(updated);

    setupTimelineStructure(
      Object.fromEntries(
        updated.map((t) => [
          t.id,
          { startDate: t.startDate, endDate: t.endDate },
        ]),
      ),
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
    );
  };
}
