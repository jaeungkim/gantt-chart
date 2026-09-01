import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
} from "constants/gantt";
import { useRef } from "react";
import { useGanttStore } from "stores/store";
import { GanttDragOffset } from "types/gantt";
import { isMilestoneTask, Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";

export type DragMode = "bar" | "left" | "right";

interface DragContext {
  mode: DragMode;
  pointerId: number;
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
  // 마일스톤과 좁은 바는 리사이즈 불가 - 엣지 영역이 바 전체를 덮어 이동이 막히는 것을 방지
  const detectDragMode = (e: React.PointerEvent<HTMLDivElement>): DragMode => {
    if (isMilestoneTask(task)) return "bar";

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width < MIN_RESIZABLE_WIDTH) return "bar";

    const relativeX = e.clientX - rect.left;

    if (relativeX <= EDGE_THRESHOLD) return "left";
    if (relativeX >= rect.width - EDGE_THRESHOLD) return "right";
    return "bar";
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // 주 포인터의 왼쪽 버튼만 드래그 시작 (우클릭/보조 터치는 무시)
    if (!e.isPrimary || e.button !== 0) return;
    // 이미 드래그 중이면 두 번째 포인터를 무시
    if (dragContextRef.current) return;

    const mode = detectDragMode(e);
    dragModeRef.current = mode;

    dragContextRef.current = {
      mode,
      pointerId: e.pointerId,
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
      if (!ctx || moveEvent.pointerId !== ctx.pointerId) return;

      const deltaX = moveEvent.clientX - ctx.initialClientX;
      const rawSteps = Math.round(deltaX / ctx.basePxPerDragStep);

      // 최소 한 스텝 너비는 남기도록 스텝 자체를 클램프
      // (미리보기만 막고 커밋은 그대로 두면 end < start 로 커밋된다)
      const maxShrinkSteps = Math.floor(
        (ctx.initialBarWidth - ctx.basePxPerDragStep) / ctx.basePxPerDragStep
      );
      let steps = rawSteps;
      if (ctx.mode === "left") steps = Math.min(rawSteps, maxShrinkSteps);
      if (ctx.mode === "right") steps = Math.max(rawSteps, -maxShrinkSteps);

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
          break;

        case "right":
          newStartDate = ctx.initialStartDate;
          newEndDate = ctx.initialEndDate.add(totalMinutes, "minute");
          offsetX = 0;
          offsetWidth = draggedPx;
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

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };

    const endDrag = (taskId: string) => {
      dragContextRef.current = null;
      dragModeRef.current = null;
      useGanttStore.getState().setCurrentTask(null);
      useGanttStore.getState().clearDragOffset(taskId);
    };

    // 브라우저가 제스처를 취소한 경우(스크롤 인계, 멀티터치 등)는 커밋하지 않고 되돌린다
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      const ctx = dragContextRef.current;
      if (ctx && cancelEvent.pointerId !== ctx.pointerId) return;

      detachListeners();
      if (ctx) endDrag(ctx.taskId);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const pending = dragContextRef.current;
      if (pending && upEvent.pointerId !== pending.pointerId) return;

      detachListeners();

      const ctx = pending;
      if (!ctx) {
        return;
      }

      if (ctx.dragSteps === 0) {
        endDrag(ctx.taskId);
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

      // dragOffset은 여기서 지우지 않는다 - 새 transformedTasks가 계산되기 전에
      // 지우면 바가 한 프레임 동안 원위치로 돌아갔다 오는 깜빡임이 생긴다.
      // Gantt의 타임라인 재계산 이펙트가 새 위치와 함께 한 번에 정리한다.
      dragContextRef.current = null;
      dragModeRef.current = null;
      useGanttStore.getState().setCurrentTask(null);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  };

  return { 
    onPointerDown, 
    dragMode: dragModeRef.current 
  };
}
