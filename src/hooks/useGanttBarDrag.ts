import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useRef } from "react";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import { GanttDragOffset } from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";

export type DragMode = "bar" | "left" | "right";

interface DragContext {
  mode: DragMode;
  initialClientX: number;
  initialStartDate: dayjs.Dayjs;
  initialEndDate: dayjs.Dayjs;
  dragSteps: number;
  basePxPerDragStep: number;
  minutesPerPixel: number;
}

// 시간 단위 변환 상수
const TIME_UNIT_MULTIPLIERS = {
  minute: 1,
  hour: 60,
  day: 60 * 24,
  week: 60 * 24 * 7,
  month: 60 * 24 * 30,
} as const;

// 드래그 제약 계산
const calculateDragConstraints = (
  deltaX: number,
  mode: DragMode,
  initialWidth: number,
  basePxPerDragStep: number
): number => {
  if (mode === "left") {
    return Math.min(deltaX, initialWidth - basePxPerDragStep);
  }
  if (mode === "right") {
    return Math.max(deltaX, -initialWidth + basePxPerDragStep);
  }
  return deltaX;
};

// 그리드에 스냅
const snapToGrid = (
  deltaX: number,
  mode: DragMode,
  basePxPerDragStep: number
): number => {
  if (mode === "left" && deltaX < 0) {
    return Math.floor(deltaX / basePxPerDragStep) * basePxPerDragStep;
  }
  if (mode === "right" && deltaX > 0) {
    return Math.ceil(deltaX / basePxPerDragStep) * basePxPerDragStep;
  }
  return deltaX;
};

// 드래그 오프셋 생성
const createDragOffset = (
  mode: DragMode,
  draggedPx: number,
  offsetStartDate: dayjs.Dayjs,
  offsetEndDate: dayjs.Dayjs
): GanttDragOffset => {
  const baseOffset = { offsetStartDate, offsetEndDate };

  switch (mode) {
    case "bar":
      return { ...baseOffset, offsetX: draggedPx, offsetWidth: 0 };
    case "left":
      return { ...baseOffset, offsetX: draggedPx, offsetWidth: -draggedPx };
    case "right":
      return { ...baseOffset, offsetX: 0, offsetWidth: draggedPx };
    default:
      return { ...baseOffset, offsetX: 0, offsetWidth: 0 };
  }
};

// 엣지 감지 영역 (px)
const EDGE_THRESHOLD = 8;

// 드래그 모드 감지 (클릭 위치 기반)
const detectDragMode = (e: React.PointerEvent<HTMLDivElement>): DragMode => {
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const relativeX = e.clientX - rect.left;

  if (relativeX <= EDGE_THRESHOLD) return "left";
  if (relativeX >= rect.width - EDGE_THRESHOLD) return "right";
  return "bar";
};

/**
 * Gantt 바 드래그 기능을 제공하는 훅
 * 바 이동, 시작일 조정, 종료일 조정 지원
 */
export function useGanttBarDrag(
  task: TaskTransformed,
  onTasksChange?: (updatedTasks: Task[]) => void
) {
  // 통합된 셀렉터 사용
  const {
    rawTasks,
    selectedScale,
    setCurrentTask,
    setDragOffset,
    clearDragOffset,
    setRawTasks,
  } = useGanttSelectors();

  const dragContextRef = useRef<DragContext | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // 스케일 설정
  const scaleConfig = GANTT_SCALE_CONFIG[selectedScale];
  const { basePxPerDragStep, dragStepAmount, dragStepUnit } = scaleConfig;
  const minutesPerPixel =
    (dragStepAmount * TIME_UNIT_MULTIPLIERS[dragStepUnit]) / basePxPerDragStep;

  const onPointerMove = (e: PointerEvent) => {
    const ctx = dragContextRef.current;
    if (!ctx) return;

    let deltaX = e.clientX - ctx.initialClientX;
    deltaX = calculateDragConstraints(deltaX, ctx.mode, task.barWidth, basePxPerDragStep);
    deltaX = snapToGrid(deltaX, ctx.mode, basePxPerDragStep);

    const steps = Math.round(deltaX / ctx.basePxPerDragStep);
    if (steps === ctx.dragSteps) return;

    ctx.dragSteps = steps;
    const draggedPx = steps * ctx.basePxPerDragStep;
    const totalDraggedMinutes = draggedPx * ctx.minutesPerPixel;

    const offsetStartDate =
      ctx.mode === "right"
        ? ctx.initialStartDate
        : ctx.initialStartDate.add(totalDraggedMinutes, "minute");

    const offsetEndDate =
      ctx.mode === "left"
        ? ctx.initialEndDate
        : ctx.initialEndDate.add(totalDraggedMinutes, "minute");

    setDragOffset(task.id, createDragOffset(ctx.mode, draggedPx, offsetStartDate, offsetEndDate));
  };

  const onPointerUp = () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);

    const ctx = dragContextRef.current;
    if (!ctx) return;

    // 날짜 조정 함수
    const adjustDate = (date: dayjs.Dayjs) =>
      date.add(ctx.dragSteps * dragStepAmount, dragStepUnit as dayjs.ManipulateType).toISOString();

    // 태스크 업데이트
    const updatedTasks = rawTasks.map((t) => {
      if (t.id !== task.id) return t;

      switch (ctx.mode) {
        case "bar":
          return {
            ...t,
            startDate: adjustDate(dayjs(t.startDate)),
            endDate: adjustDate(dayjs(t.endDate)),
          };
        case "left":
          return { ...t, startDate: adjustDate(dayjs(t.startDate)) };
        case "right":
          return { ...t, endDate: adjustDate(dayjs(t.endDate)) };
        default:
          return t;
      }
    });

    setRawTasks(updatedTasks);
    onTasksChange?.(updatedTasks);

    // 정리
    const pointerId = activePointerIdRef.current;
    if (pointerId !== null) {
      document.getElementById(`task-${task.id}`)?.releasePointerCapture(pointerId);
    }

    activePointerIdRef.current = null;
    dragContextRef.current = null;
    setCurrentTask(null);
    clearDragOffset(task.id);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const mode = detectDragMode(e);

    dragContextRef.current = {
      mode,
      initialClientX: e.clientX,
      initialStartDate: dayjs(task.startDate),
      initialEndDate: dayjs(task.endDate),
      dragSteps: 0,
      basePxPerDragStep,
      minutesPerPixel,
    };

    setCurrentTask(task);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  };

  return { onPointerDown };
}
