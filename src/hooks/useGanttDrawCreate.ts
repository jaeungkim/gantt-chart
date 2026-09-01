import { NODE_HEIGHT } from "constants/gantt";
import { useRef, useState } from "react";
import { useGanttStoreApi } from "stores/context";
import { armPointerGesture, suppressTouchScroll } from "utils/pointerGesture";
import { snapDrawnRange } from "utils/timeline";

/** Below this many px the gesture is a click, not a drawn range */
const MIN_DRAW_PX = 4;

/** The task the user drew, handed to `onTaskCreate` - nothing is committed by the chart */
export interface GanttTaskDraft {
  /** UTC ISO string, snapped to the current scale */
  startDate: string;
  endDate: string;
  /** Id of the task whose row the range was drawn on, null when the row has none */
  rowTaskId: string | null;
}

/** The ghost bar drawn while the pointer is down (px, timeline content coordinates) */
interface DrawGhost {
  leftPx: number;
  widthPx: number;
  topPx: number;
}

interface UseGanttDrawCreateParams {
  enabled: boolean;
  /** Rows on screen, in order - the row under the pointer names the task it belongs to */
  rowIds: (string | null)[];
  onTaskCreate?: (draft: GanttTaskDraft) => void;
}

/**
 * Drawing a new task on the empty part of a row
 *
 * The chart never adds the task itself: the drawn range is snapped to the current scale
 * and handed to `onTaskCreate`, and the host decides what (if anything) to do with it.
 */
export function useGanttDrawCreate({
  enabled,
  rowIds,
  onTaskCreate,
}: UseGanttDrawCreateParams) {
  const storeApi = useGanttStoreApi();
  const [ghost, setGhost] = useState<DrawGhost | null>(null);
  // Only touched inside the pointer handlers, never while rendering
  const activePointerRef = useRef<number | null>(null);
  // Abort for a touch press still waiting to become a draw
  const pendingGestureRef = useRef<(() => void) | null>(null);

  const onDrawPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !e.isPrimary || e.button !== 0) return;
    if (activePointerRef.current !== null) return;
    // Empty space only - bars, arrows and handles are their own targets and run their own gestures
    if (e.target !== e.currentTarget) return;

    // A press given up to a scroll leaves its abort behind - the primary pointer can
    // only be down once, so anything still pending belongs to the past
    pendingGestureRef.current?.();
    pendingGestureRef.current = null;

    const content = e.currentTarget;
    const pointerId = e.pointerId;

    // Same rule as a bar drag: a mouse draws at once, a finger has to rest first so a
    // swipe across empty row space still scrolls the timeline
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
    const rowIndex = Math.floor((startClientY - startRect.top) / NODE_HEIGHT);
    activePointerRef.current = pointerId;
    // touch-action is fixed when the gesture starts, so the browser has to be told
    // separately to stop panning once the long press has lifted into a draw
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
          topPx: rowIndex * NODE_HEIGHT,
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
        rowTaskId: rowIds[rowIndex] ?? null,
      });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);
  };

  return { onDrawPointerDown, ghost };
}
