import { HEADER_HEIGHT, LINK_DRAG_SLOP } from "shared/constants";
import { useEffect, useRef } from "react";
import { useGanttStoreApi } from "shared/context";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import {
  addDependency,
  linkTypeFromAnchors,
  resolveLinkTarget,
  validateDependency,
} from "features/dependencies/utils/link";
import { anchorPoint } from "features/dependencies/utils/arrowPath";
import { GanttDependencyChange } from "features/dependencies/types";
import { GanttGeometry, LinkAnchor, LinkRejection } from "shared/types";
import { edgeScrollVelocity, timelineEdges } from "features/timeline/utils/viewport";

interface UseGanttLinkDragParams {
  task: TaskTransformed;
  interaction?: GanttInteractionConfig;
  onTasksChange?: (updatedTasks: Task[]) => void;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  geometry: GanttGeometry;
}

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

export function isOverVisibleContent(
  clientX: number,
  clientY: number,
  edges: ReturnType<typeof timelineEdges>
): boolean {
  return (
    clientX >= edges.left &&
    clientX < edges.right &&
    clientY >= edges.top + HEADER_HEIGHT &&
    clientY < edges.bottom
  );
}

export function useGanttLinkDrag({
  task,
  interaction,
  onTasksChange,
  onDependencyCreate,
  geometry,
}: UseGanttLinkDragParams) {
  const storeApi = useGanttStoreApi();
  const activePointerRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const startLink =
    (anchor: LinkAnchor) => (e: React.PointerEvent<HTMLElement>) => {
      if (!e.isPrimary || e.button !== 0) return;
      if (activePointerRef.current !== null) return;

      e.stopPropagation();
      e.preventDefault();

      const handle = e.currentTarget;
      const content = handle.closest<HTMLElement>(".gantt-content");
      const scrollEl = handle.closest<HTMLElement>(".gantt-scroll-container");
      if (!content) return;

      const sourceGone = () =>
        !content.isConnected ||
        !storeApi.getState().rawTasks.some((t) => t.id === task.id);

      const pointerId = e.pointerId;
      activePointerRef.current = pointerId;

      try {
        handle.setPointerCapture(pointerId);
      } catch {}

      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let lastX = startX;
      let lastY = startY;

      const previousCursor = document.body.style.cursor;

      const resolveHover = (clientX: number, clientY: number): HoverState => {
        if (
          scrollEl &&
          !isOverVisibleContent(clientX, clientY, timelineEdges(scrollEl))
        ) {
          return NO_HOVER;
        }

        const rect = content.getBoundingClientRect();
        const target = resolveLinkTarget(
          storeApi.getState().rowTasks,
          clientX - rect.left,
          clientY - rect.top,
          geometry
        );
        if (!target || target.task.id === task.id) return NO_HOVER;

        const rawTasks = storeApi.getState().rawTasks;
        const raw = rawTasks.find((t) => t.id === target.task.id);
        if (!raw || !resolveTaskInteraction(raw, interaction).canCreateLink) {
          return NO_HOVER;
        }

        return {
          hoverTaskId: target.task.id,
          hoverAnchor: target.anchor,
          rejection: validateDependency(rawTasks, task.id, target.task.id),
        };
      };

      const from = anchorPoint(task, anchor, geometry);

      const publishDraft = (clientX: number, clientY: number) => {
        const rect = content.getBoundingClientRect();
        storeApi.getState().setLinkDraft({
          fromTaskId: task.id,
          fromAnchor: anchor,
          fromX: from.x,
          fromY: from.y,
          toX: clientX - rect.left,
          toY: clientY - rect.top,
          ...resolveHover(clientX, clientY),
        });
      };

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

        if (
          scrollEl.scrollLeft === beforeX &&
          scrollEl.scrollTop === beforeY
        ) {
          stopAutoScroll();
          return;
        }

        publishDraft(lastX, lastY);
        autoScrollFrame = requestAnimationFrame(runAutoScroll);
      };

      const updateAutoScroll = (clientX: number, clientY: number) => {
        if (!scrollEl) return;

        const edges = timelineEdges(scrollEl);
        velocityX = edgeScrollVelocity(clientX, edges.left, edges.right);
        velocityY = edgeScrollVelocity(clientY, edges.top, edges.bottom);

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
        } catch {}
      };

      const cancelLink = () => {
        detachListeners();
        cleanupRef.current = null;
        activePointerRef.current = null;
        storeApi.getState().setLinkDraft(null);
      };

      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        cancelLink();
      };

      function handleKeyDown(keyEvent: KeyboardEvent) {
        if (keyEvent.key === "Escape") cancelLink();
      }

      function handlePointerUp(upEvent: PointerEvent) {
        if (upEvent.pointerId !== pointerId) return;

        const hover =
          dragging && !sourceGone()
            ? resolveHover(upEvent.clientX, upEvent.clientY)
            : NO_HOVER;
        cancelLink();

        if (!hover.hoverTaskId || !hover.hoverAnchor || hover.rejection) return;

        const change: GanttDependencyChange = {
          predecessorId: task.id,
          successorId: hover.hoverTaskId,
          type: linkTypeFromAnchors(anchor, hover.hoverAnchor),
        };

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

      cleanupRef.current = () => {
        if (sourceGone()) cancelLink();
      };
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
      document.addEventListener("keydown", handleKeyDown);
    };

  return { startLink };
}
