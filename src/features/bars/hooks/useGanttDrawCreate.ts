import { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { GanttBottomRowCell, GanttGeometry, GanttScaleKey } from "shared/types";
import { useGanttStoreApi } from "shared/context";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";
import { calculateDateOffsetPx, snapDrawnRange } from "features/timeline/utils/geometry";
import { GanttTaskDraft } from "features/bars/types";

// Below this many px the gesture is a click, not a drawn range
const MIN_DRAW_PX = 4;

const toDraft = (range: { startDate: Dayjs; endDate: Dayjs }): GanttTaskDraft => ({
  startDate: range.startDate.toISOString(),
  endDate: range.endDate.toISOString(),
});

// The draft an "add task" click proposes: one tick long at `now`, or at the first tick when
// `now` is outside the rendered timeline. Null while there are no cells.
export function defaultTaskDraft(
  now: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): GanttTaskDraft | null {
  const px = calculateDateOffsetPx(now, timelineTicks, scaleKey) ?? 0;
  const range = snapDrawnRange(px, px, timelineTicks, scaleKey);
  return range ? toDraft(range) : null;
}

// px, timeline content coordinates
interface DrawGhost {
  leftPx: number;
  widthPx: number;
  topPx: number;
}

interface UseGanttDrawCreateParams {
  enabled: boolean;
  // Rows on screen - the blank region below starts under them
  rowCount: number;
  onTaskCreate?: (draft: GanttTaskDraft) => void;
  geometry: GanttGeometry;
}

// The blank region under the last row is one draw target, pinned there; a press on a row is not a draw
export function drawSlotTopPx(
  offsetY: number,
  rowCount: number,
  geometry: GanttGeometry
): number | null {
  const topPx = rowCount * geometry.rowHeight;
  return offsetY < topPx ? null : topPx;
}

// Draws a new task under the last row; the snapped range is handed to `onTaskCreate` and
// never committed by the chart.
export function useGanttDrawCreate({
  enabled,
  rowCount,
  onTaskCreate,
  geometry,
}: UseGanttDrawCreateParams) {
  const storeApi = useGanttStoreApi();
  const [ghost, setGhost] = useState<DrawGhost | null>(null);
  const activePointerRef = useRef<number | null>(null);
  // Abort for a touch press still waiting to become a draw
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
    // a draw released off the content sends its click elsewhere, so the flag can outlive it
    drewRef.current = false;
    if (!enabled || !e.isPrimary || e.button !== 0) return;
    if (activePointerRef.current !== null) return;
    // Empty space only - bars, arrows and handles run their own gestures
    if (e.target !== e.currentTarget) return;

    // A press given up to a scroll leaves its abort behind - clear it before arming the next
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const content = e.currentTarget;
    const pointerId = e.pointerId;

    // Same rule as a bar drag: a mouse draws at once, a finger has to rest first so a swipe
    // across the blank space still scrolls the timeline
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
    // touch-action is fixed when the gesture starts, so panning must be stopped separately
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const rangeAt = (x: number) => {
      const { bottomRowCells, selectedScale } = storeApi.getState();
      return snapDrawnRange(originX, x, bottomRowCells, selectedScale);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      // Re-read the rect every frame - the container may have been scrolled mid-drag
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

    // A chart unmounted mid-draw drops the draw rather than propose a task from its release
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
