import { Dayjs } from "dayjs";
import { NODE_HEIGHT } from "shared/constants";
import { useRef, useState } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { useGanttStoreApi } from "shared/context";
import { armPointerGesture, suppressTouchScroll } from "shared/utils/pointerGesture";
import { calculateDateOffsetPx, snapDrawnRange } from "timeline/utils/geometry";

// Below this many px the gesture is a click, not a drawn range
const MIN_DRAW_PX = 4;

/** The task the user drew, handed to `onTaskCreate` - nothing is committed by the chart */
export interface GanttTaskDraft {
  /** UTC ISO string, snapped to the current scale */
  startDate: string;
  endDate: string;
}

// The draft an "add task" click proposes: one tick long at `now`, or at the first tick when
// `now` is outside the rendered timeline. Null while there are no cells.
export function defaultTaskDraft(
  now: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): GanttTaskDraft | null {
  const px = calculateDateOffsetPx(now, timelineTicks, scaleKey) ?? 0;
  const range = snapDrawnRange(px, px, timelineTicks, scaleKey);
  if (!range) return null;

  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };
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
}

// The blank region under the last row is one draw target, pinned there; a press on a row is
// not a draw, since the bar, handles and arrows run their own gestures.
export function drawSlotTopPx(offsetY: number, rowCount: number): number | null {
  const topPx = rowCount * NODE_HEIGHT;
  return offsetY < topPx ? null : topPx;
}

// Draws a new task under the last row; the snapped range is handed to `onTaskCreate` and
// never committed by the chart.
export function useGanttDrawCreate({
  enabled,
  rowCount,
  onTaskCreate,
}: UseGanttDrawCreateParams) {
  const storeApi = useGanttStoreApi();
  const [ghost, setGhost] = useState<DrawGhost | null>(null);
  const activePointerRef = useRef<number | null>(null);
  // Abort for a touch press still waiting to become a draw
  const pendingGestureRef = useRef<(() => void) | null>(null);

  const onDrawPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    const topPx = drawSlotTopPx(startClientY - startRect.top, rowCount);
    if (topPx === null) return;
    activePointerRef.current = pointerId;
    // touch-action is fixed when the gesture starts, so panning must be stopped separately
    const releaseTouchScroll =
      pointerType === "mouse" ? null : suppressTouchScroll();

    const rangeAt = (clientX: number) => {
      const { bottomRowCells, selectedScale } = storeApi.getState();
      // Re-read the rect every frame - the container may have been scrolled mid-drag
      const rect = content.getBoundingClientRect();
      return snapDrawnRange(
        originX,
        clientX - rect.left,
        bottomRowCells,
        selectedScale
      );
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;

      const rect = content.getBoundingClientRect();
      if (Math.abs(moveEvent.clientX - rect.left - originX) < MIN_DRAW_PX) {
        setGhost(null);
        return;
      }

      const range = rangeAt(moveEvent.clientX);
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

      const rect = content.getBoundingClientRect();
      const drawn =
        Math.abs(upEvent.clientX - rect.left - originX) >= MIN_DRAW_PX;
      const range = drawn ? rangeAt(upEvent.clientX) : null;
      endDraw();

      if (!range) return;

      onTaskCreate?.({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);
  };

  return { onDrawPointerDown, ghost };
}
