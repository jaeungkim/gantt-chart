import {
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  MIN_RESIZABLE_WIDTH,
} from "constants/gantt";
import { Dayjs } from "dayjs";
import { useRef } from "react";
import { useGanttStore, useGanttStoreApi } from "stores/context";
import { GanttDragOffset, GanttScaleKey } from "types/gantt";
import { isMilestoneTask, Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import { shiftByDragSteps } from "utils/timeline";

export type DragMode = "bar" | "left" | "right";

interface DragContext {
  mode: DragMode;
  pointerId: number;
  initialClientX: number;
  initialStartDate: Dayjs;
  initialEndDate: Dayjs;
  initialBarWidth: number;
  dragSteps: number;
  basePxPerDragStep: number;
  // 드래그 도중 스케일이 바뀌어도 시작 시점의 스텝 단위로 계산한다
  scaleKey: GanttScaleKey;
  taskId: string;
}

/**
 * Gantt 바 드래그 기능을 제공하는 훅
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  const storeApi = useGanttStoreApi();
  const dragContextRef = useRef<DragContext | null>(null);
  const dragModeRef = useRef<DragMode | null>(null);
  const onTasksChangeRef = useRef(onTasksChange);
  onTasksChangeRef.current = onTasksChange;

  const selectedScale = useGanttStore((s) => s.selectedScale);
  const { basePxPerDragStep } = GANTT_SCALE_CONFIG[selectedScale];

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
      scaleKey: selectedScale,
      taskId: task.id,
    };

    storeApi.getState().setCurrentTask(task);
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
      const shift = (date: Dayjs) => shiftByDragSteps(date, steps, ctx.scaleKey);

      let newStartDate: Dayjs;
      let newEndDate: Dayjs;
      let offsetX = 0;
      let offsetWidth = 0;

      switch (ctx.mode) {
        case "bar":
          newStartDate = shift(ctx.initialStartDate);
          newEndDate = shift(ctx.initialEndDate);
          offsetX = draggedPx;
          offsetWidth = 0;
          break;

        case "left":
          newStartDate = shift(ctx.initialStartDate);
          newEndDate = ctx.initialEndDate;
          offsetX = draggedPx;
          offsetWidth = -draggedPx;
          break;

        case "right":
          newStartDate = ctx.initialStartDate;
          newEndDate = shift(ctx.initialEndDate);
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

      storeApi.getState().setDragOffset(ctx.taskId, offset);
    };

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };

    const endDrag = (taskId: string) => {
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
      storeApi.getState().clearDragOffset(taskId);
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

      const currentRawTasks = storeApi.getState().rawTasks;
      const commit = (date: string) =>
        shiftByDragSteps(dayjs(date), ctx.dragSteps, ctx.scaleKey).toISOString();

      const updatedTasks = currentRawTasks.map((t) => {
        if (t.id !== ctx.taskId) return t;

        switch (ctx.mode) {
          case "bar":
            return {
              ...t,
              startDate: commit(t.startDate),
              endDate: commit(t.endDate),
            };

          case "left":
            return {
              ...t,
              startDate: commit(t.startDate),
            };

          case "right":
            return {
              ...t,
              endDate: commit(t.endDate),
            };

          default:
            return t;
        }
      });

      storeApi.getState().setRawTasks(updatedTasks);
      onTasksChangeRef.current?.(updatedTasks);

      // dragOffset은 여기서 지우지 않는다 - 새 transformedTasks가 계산되기 전에
      // 지우면 바가 한 프레임 동안 원위치로 돌아갔다 오는 깜빡임이 생긴다.
      // Gantt의 타임라인 재계산 이펙트가 새 위치와 함께 한 번에 정리한다.
      dragContextRef.current = null;
      dragModeRef.current = null;
      storeApi.getState().setCurrentTask(null);
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
