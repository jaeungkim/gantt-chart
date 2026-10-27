import { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { GanttBottomRowCell, GanttGeometry, GanttScaleKey } from "shared/types";
import { useGanttStoreApi } from "shared/context";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";
import { calculateDateOffsetPx, snapDrawnRange } from "features/timeline/utils/geometry";
import { GanttTaskDraft } from "features/bars/types";

const MIN_DRAW_PX = 4;

const toDraft = (range: { startDate: Dayjs; endDate: Dayjs }): GanttTaskDraft => ({
  startDate: range.startDate.toISOString(),
  endDate: range.endDate.toISOString(),
});

export function defaultTaskDraft(
  now: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): GanttTaskDraft | null {
  const px = calculateDateOffsetPx(now, timelineTicks, scaleKey) ?? 0;
  const range = snapDrawnRange(px, px, timelineTicks, scaleKey);
  return range ? toDraft(range) : null;
}

interface DrawGhost {
  leftPx: number;
  widthPx: number;
  topPx: number;
}

interface UseGanttDrawCreateParams {
  enabled: boolean;
  rowCount: number;
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  geometry: GanttGeometry;
}

export function drawSlotTopPx(
  offsetY: number,
  rowCount: number,
  geometry: GanttGeometry
): number | null {
  const topPx = rowCount * geometry.rowHeight;
  return offsetY < topPx ? null : topPx;
}

export function useGanttDrawCreate({
  enabled,
  rowCount,
  onTaskCreate,
  geometry,
}: UseGanttDrawCreateParams) {
  const storeApi = useGanttStoreApi();
  const [ghost, setGhost] = useState<DrawGhost | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const pendingGestureRef = useRef<(() => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const drewRef = useRef(false);

  useEffect(
    () => () => {
      pendingGestureRef.current?.();
      cleanupRef.current?.();
    },
    []
  );

  const onDrawPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drewRef.current = false;
    if (!enabled || !e.isPrimary || e.button !== 0) return;
    if (activePointerRef.current !== null) return;
    if (e.target !== e.currentTarget) return;

    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const content = e.currentTarget;
    const pointerId = e.pointerId;

    pendingGestureRef.current = armPointerGesture(
      { pointerType: e.pointerType, pointerId, clientX: e.clientX, clientY: e.clientY },
      (clientX, clientY) => {
        pendingGestureRef.current = null;
        startDraw(content, pointerId, e.pointerType, clientX, clientY);
      }
    );
  };

  const startDraw = (
    content: HTMLDivElement,
    pointerId: number,
    pointerType: string,
    startClientX: number,
    startClientY: number
  ) => {
    const startRect = content.getBoundingClientRect();
    const originX = startClientX - startRect.left;
    const topPx = drawSlotTopPx(startClientY - startRect.top, rowCount, geometry);
    if (topPx === null) return;
    activePointerRef.current = pointerId;
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const rangeAt = (x: number) => {
      const { bottomRowCells, selectedScale } = storeApi.getState();
      return snapDrawnRange(originX, x, bottomRowCells, selectedScale);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const x = moveEvent.clientX - content.getBoundingClientRect().left;
      if (Math.abs(x - originX) < MIN_DRAW_PX) {
        setGhost(null);
        return;
      }

      const range = rangeAt(x);
      setGhost(
        range && {
          leftPx: range.leftPx,
          widthPx: range.widthPx,
          topPx,
        }
      );
    };

    const detachListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown);
    };

    const endDraw = () => {
      detachListeners();
      releaseTouchScroll?.();
      activePointerRef.current = null;
      cleanupRef.current = null;
      setGhost(null);
    };

    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      endDraw();
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") endDraw();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;

      const x = upEvent.clientX - content.getBoundingClientRect().left;
      drewRef.current = Math.abs(x - originX) >= MIN_DRAW_PX;
      const range = drewRef.current ? rangeAt(x) : null;
      endDraw();

      if (range) onTaskCreate?.(toDraft(range));
    };

    cleanupRef.current = endDraw;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);
  };

  const consumeDrawClick = (): boolean => {
    if (!drewRef.current) return false;
    drewRef.current = false;
    return true;
  };

  return { onDrawPointerDown, consumeDrawClick, ghost };
}
