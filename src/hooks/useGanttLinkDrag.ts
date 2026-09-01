import { useRef } from "react";
import { useGanttStoreApi } from "stores/context";
import {
  DependencyType,
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
import { anchorPoint } from "utils/arrowPath";
import {
  addDependency,
  LinkAnchor,
  LinkRejection,
  linkTypeFromAnchors,
  validateDependency,
} from "utils/dependency";

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
  /** Returning false rejects the link */
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
}

/**
 * Dragging a dependency from one of a bar's connector dots to another bar
 *
 * The gesture's direction is the dependency's direction: the bar the drag starts on is
 * the predecessor, the bar it lands on the successor. Which ends the two dots sit on
 * decides the type (see `linkTypeFromAnchors`).
 *
 * The drop target is found with `elementFromPoint` rather than from the bar geometry, so
 * virtualization, scrolling and the sticky task list pane all take care of themselves.
 */
export function useGanttLinkDrag({
  task,
  interaction,
  onTasksChange,
  onDependencyCreate,
}: UseGanttLinkDragParams) {
  const storeApi = useGanttStoreApi();
  // Only touched inside the pointer handlers, never while rendering
  const activePointerRef = useRef<number | null>(null);

  const startLink =
    (anchor: LinkAnchor) => (e: React.PointerEvent<HTMLElement>) => {
      // Same primary-pointer rule the bar drag uses
      if (!e.isPrimary || e.button !== 0) return;
      if (activePointerRef.current !== null) return;

      // The bar's own move/resize drag listens on the parent - only one gesture may start
      e.stopPropagation();
      e.preventDefault();

      const content = e.currentTarget.closest<HTMLElement>(".gantt-content");
      if (!content) return;

      const pointerId = e.pointerId;
      activePointerRef.current = pointerId;

      const from = anchorPoint(task, anchor);
      const store = storeApi.getState();
      store.setSelectedDependency(null);
      store.setLinkDraft({
        fromTaskId: task.id,
        fromAnchor: anchor,
        fromX: from.x,
        fromY: from.y,
        toX: from.x,
        toY: from.y,
        hoverTaskId: null,
        hoverAnchor: null,
        rejection: null,
      });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        // Read every frame - the container may have been scrolled mid-drag
        const rect = content.getBoundingClientRect();

        const hovered = document
          .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest<HTMLElement>("[data-task-id]");
        const hoveredId = hovered?.dataset.taskId ?? null;

        let hoverTaskId: string | null = null;
        let hoverAnchor: LinkAnchor | null = null;
        let rejection: LinkRejection | null = null;

        if (hovered && hoveredId) {
          const rawTasks = storeApi.getState().rawTasks;
          const target = rawTasks.find((t) => t.id === hoveredId);
          // A task that may not be linked is no target at all - no highlight, no drop
          const linkable =
            hoveredId === task.id ||
            (target !== undefined &&
              resolveTaskInteraction(target, interaction).canCreateLink);

          if (linkable) {
            hoverTaskId = hoveredId;
            // A milestone's element carries its label too, so measure the diamond
            const box = (
              hovered.querySelector(".gantt-milestone-diamond") ?? hovered
            ).getBoundingClientRect();
            hoverAnchor =
              moveEvent.clientX < box.left + box.width / 2 ? "start" : "end";
            rejection = validateDependency(rawTasks, task.id, hoveredId);
          }
        }

        storeApi.getState().setLinkDraft({
          fromTaskId: task.id,
          fromAnchor: anchor,
          fromX: from.x,
          fromY: from.y,
          toX: moveEvent.clientX - rect.left,
          toY: moveEvent.clientY - rect.top,
          hoverTaskId,
          hoverAnchor,
          rejection,
        });
      };

      const detachListeners = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        document.removeEventListener("keydown", handleKeyDown);
      };

      const cancelLink = () => {
        detachListeners();
        activePointerRef.current = null;
        storeApi.getState().setLinkDraft(null);
      };

      // Browser-cancelled gestures (scroll takeover, multi-touch) drop the link
      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        cancelLink();
      };

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") cancelLink();
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        const draft = storeApi.getState().linkDraft;
        cancelLink();

        // Released over empty space, over an invalid target, or without moving at all
        if (!draft?.hoverTaskId || !draft.hoverAnchor || draft.rejection) return;

        const change: GanttDependencyChange = {
          predecessorId: draft.fromTaskId,
          successorId: draft.hoverTaskId,
          type: linkTypeFromAnchors(draft.fromAnchor, draft.hoverAnchor),
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
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerCancel);
      document.addEventListener("keydown", handleKeyDown);
    };

  return { startLink };
}
