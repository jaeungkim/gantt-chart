import {
  LINK_ANCHOR_ZONE,
  LINK_DRAG_SLOP,
  NODE_HEIGHT,
} from "shared/constants";
import { useEffect, useRef } from "react";
import { useGanttStoreApi } from "shared/context";
import {
  DependencyType,
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import {
  addDependency,
  LinkAnchor,
  LinkRejection,
  linkTypeFromAnchors,
  resolveLinkTarget,
  validateDependency,
} from "dependencies/utils/link";
import { edgeScrollVelocity } from "timeline/utils/viewport";

/** The link the user drew, handed to `onDependencyCreate` before anything is committed */
export interface GanttDependencyChange {
  /** Task the drag started on */
  predecessorId: string;
  /** Task the drag was dropped on - the one whose `dependencies` gains the entry */
  successorId: string;
  type: DependencyType;
}

interface UseGanttLinkDragParams {
  task: TaskTransformed;
  interaction?: GanttInteractionConfig;
  onTasksChange?: (updatedTasks: Task[]) => void;
  // Returning false rejects the link
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
}

// What the pointer is currently over, in the shape the draft stores it
interface HoverState {
  hoverTaskId: string | null;
  hoverAnchor: LinkAnchor | null;
  rejection: LinkRejection | null;
}

const NO_HOVER: HoverState = {
  hoverTaskId: null,
  hoverAnchor: null,
  rejection: null,
};

// The bar the drag starts on is the predecessor, the one it lands on the successor; where it
// lands decides the type (`resolveLinkTarget`, `linkTypeFromAnchors`). The target is arithmetic
// on the row model, not DOM hit-testing: an overlay cannot swallow the drop and a culled row
// still accepts one.
export function useGanttLinkDrag({
  task,
  interaction,
  onTasksChange,
  onDependencyCreate,
}: UseGanttLinkDragParams) {
  const storeApi = useGanttStoreApi();
  // Only touched inside the pointer handlers, never while rendering
  const activePointerRef = useRef<number | null>(null);
  // Tears down the running gesture, on unmount too - a bar culled mid-drag must not leave
  // listeners and a draft behind
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const startLink =
    (anchor: LinkAnchor) => (e: React.PointerEvent<HTMLElement>) => {
      // Same primary-pointer rule the bar drag uses
      if (!e.isPrimary || e.button !== 0) return;
      if (activePointerRef.current !== null) return;

      // The bar's own move/resize drag listens on the parent - only one gesture may start
      e.stopPropagation();
      e.preventDefault();

      const handle = e.currentTarget;
      const content = handle.closest<HTMLElement>(".gantt-content");
      const scrollEl = handle.closest<HTMLElement>(".gantt-scroll-container");
      if (!content) return;

      const pointerId = e.pointerId;
      activePointerRef.current = pointerId;

      // Keeps pointerup coming when the release happens outside the window
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Detached or already captured elsewhere - the document listeners still run
      }

      const startX = e.clientX;
      const startY = e.clientY;
      // Published only once the pointer has travelled - a plain click on a dot stays a selection
      let dragging = false;
      // The release re-resolves from here, since a scroll can move the draft's target away
      let lastX = startX;
      let lastY = startY;

      const previousCursor = document.body.style.cursor;

      const resolveHover = (clientX: number, clientY: number): HoverState => {
        const rect = content.getBoundingClientRect();
        const target = resolveLinkTarget(
          storeApi.getState().rowTasks,
          clientX - rect.left,
          clientY - rect.top,
          NODE_HEIGHT,
          LINK_ANCHOR_ZONE
        );
        if (!target) return NO_HOVER;

        const rawTasks = storeApi.getState().rawTasks;
        const raw = rawTasks.find((t) => t.id === target.task.id);
        // A task that may not be linked is no target at all - no highlight, no drop
        const linkable =
          target.task.id === task.id ||
          (raw !== undefined &&
            resolveTaskInteraction(raw, interaction).canCreateLink);
        if (!linkable) return NO_HOVER;

        return {
          hoverTaskId: target.task.id,
          hoverAnchor: target.anchor,
          rejection: validateDependency(rawTasks, task.id, target.task.id),
        };
      };

      const publishDraft = (clientX: number, clientY: number) => {
        const rect = content.getBoundingClientRect();
        storeApi.getState().setLinkDraft({
          fromTaskId: task.id,
          fromAnchor: anchor,
          toX: clientX - rect.left,
          toY: clientY - rect.top,
          ...resolveHover(clientX, clientY),
        });
      };

      // Without edge auto-scroll a link can only join two tasks on screen at the same time
      let autoScrollFrame: number | null = null;
      let velocityX = 0;
      let velocityY = 0;

      const stopAutoScroll = () => {
        if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
        velocityX = 0;
        velocityY = 0;
      };

      const runAutoScroll = () => {
        autoScrollFrame = null;
        if (!scrollEl || (velocityX === 0 && velocityY === 0)) return;

        const beforeX = scrollEl.scrollLeft;
        const beforeY = scrollEl.scrollTop;
        scrollEl.scrollLeft = beforeX + velocityX;
        scrollEl.scrollTop = beforeY + velocityY;

        // Nothing moved: already against that end. Stopping matters - the first and last rows
        // sit inside the edge zone, so the loop would run for the rest of the gesture.
        if (
          scrollEl.scrollLeft === beforeX &&
          scrollEl.scrollTop === beforeY
        ) {
          stopAutoScroll();
          return;
        }

        // The content moved under a pointer that did not - re-read the target
        publishDraft(lastX, lastY);
        autoScrollFrame = requestAnimationFrame(runAutoScroll);
      };

      const updateAutoScroll = (clientX: number, clientY: number) => {
        if (!scrollEl) return;

        const rect = scrollEl.getBoundingClientRect();
        // The pinned task list covers the left, so the timeline's edge starts where it ends
        const gridEl = scrollEl.querySelector<HTMLElement>(".gantt-grid");
        velocityX = edgeScrollVelocity(
          clientX,
          rect.left + (gridEl?.offsetWidth ?? 0),
          rect.right
        );
        velocityY = edgeScrollVelocity(clientY, rect.top, rect.bottom);

        if (velocityX === 0 && velocityY === 0) {
          stopAutoScroll();
        } else if (autoScrollFrame === null) {
          autoScrollFrame = requestAnimationFrame(runAutoScroll);
        }
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        lastX = moveEvent.clientX;
        lastY = moveEvent.clientY;

        if (!dragging) {
          if (
            Math.abs(lastX - startX) < LINK_DRAG_SLOP &&
            Math.abs(lastY - startY) < LINK_DRAG_SLOP
          ) {
            return;
          }
          dragging = true;
          storeApi.getState().setSelectedDependency(null);
          // The dot's own crosshair does not follow the pointer off the bar
          document.body.style.cursor = "crosshair";
        }

        updateAutoScroll(lastX, lastY);
        publishDraft(lastX, lastY);
      };

      const detachListeners = () => {
        stopAutoScroll();
        document.body.style.cursor = previousCursor;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        document.removeEventListener("keydown", handleKeyDown);
        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          // Already released, or the handle is gone
        }
      };

      const cancelLink = () => {
        detachListeners();
        cleanupRef.current = null;
        activePointerRef.current = null;
        storeApi.getState().setLinkDraft(null);
      };

      // Browser-cancelled gestures (scroll takeover, multi-touch) drop the link
      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        cancelLink();
      };

      function handleKeyDown(keyEvent: KeyboardEvent) {
        if (keyEvent.key === "Escape") cancelLink();
      }

      function handlePointerUp(upEvent: PointerEvent) {
        if (upEvent.pointerId !== pointerId) return;

        const wasDragging = dragging;
        // Re-resolved, not read off the draft: a wheel scroll with the button held moves the
        // content without firing pointermove, and the stale draft would commit the wrong task
        const hover = wasDragging
          ? resolveHover(upEvent.clientX, upEvent.clientY)
          : NO_HOVER;
        cancelLink();

        if (!hover.hoverTaskId || !hover.hoverAnchor || hover.rejection) return;

        const change: GanttDependencyChange = {
          predecessorId: task.id,
          successorId: hover.hoverTaskId,
          type: linkTypeFromAnchors(anchor, hover.hoverAnchor),
        };

        // The host gets the last word before anything changes
        if (onDependencyCreate?.(change) === false) return;

        const updatedTasks = addDependency(
          storeApi.getState().rawTasks,
          change.predecessorId,
          change.successorId,
          change.type
        );
        storeApi.getState().setRawTasks(updatedTasks);
        onTasksChange?.(updatedTasks);
      }

      cleanupRef.current = cancelLink;
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
      document.addEventListener("keydown", handleKeyDown);
    };

  return { startLink };
}
