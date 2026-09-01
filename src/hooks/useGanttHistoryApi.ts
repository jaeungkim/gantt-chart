import React, { useCallback, useMemo } from "react";
import { useGanttStoreApi } from "stores/context";
import { Task } from "types/task";

/** Imperative undo/redo API */
export interface GanttHistoryApi {
  /** Reverts the newest gesture and fires `onTasksChange`. No-op with an empty stack. */
  undo: () => void;
  /** Replays the newest undone gesture and fires `onTasksChange`. No-op with an empty stack. */
  redo: () => void;
  /** Whether there is a gesture to undo */
  canUndo: boolean;
  /** Whether there is an undone gesture to redo */
  canRedo: boolean;
}

/** Elements that own their own Ctrl+Z - a chart shortcut must never take it from them */
const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Whether the key event landed in something the user is typing into, e.g. an input
 * rendered by a custom task list cell
 */
export function isTextEntryTarget(target: unknown): boolean {
  const element = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
  } | null;
  if (!element || typeof element.tagName !== "string") return false;

  return (
    element.isContentEditable === true || TEXT_ENTRY_TAGS.has(element.tagName)
  );
}

/**
 * Undo/redo for the chart: the imperative methods plus the keyboard shortcuts.
 *
 * The key handler is meant for the chart container, so it only ever sees events
 * from inside the chart - the shortcut does nothing while the chart is not focused.
 */
export function useGanttHistoryApi(
  onTasksChange?: (updatedTasks: Task[]) => void
): {
  historyApi: GanttHistoryApi;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
} {
  const storeApi = useGanttStoreApi();

  // Undo and redo are mutations like any other, so the host hears about them the same way
  const undo = useCallback(() => {
    const updated = storeApi.getState().undo();
    if (updated) onTasksChange?.(updated);
  }, [storeApi, onTasksChange]);

  const redo = useCallback(() => {
    const updated = storeApi.getState().redo();
    if (updated) onTasksChange?.(updated);
  }, [storeApi, onTasksChange]);

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLElement>>(
    (event) => {
      // Ctrl on Windows/Linux, Cmd on macOS. Alt is a different shortcut entirely.
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isTextEntryTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      // Ctrl+Y and Cmd+Shift+Z are the same command on their respective platforms;
      // both are accepted everywhere rather than sniffing the platform
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    },
    [undo, redo]
  );

  // canUndo/canRedo are getters so they are read fresh, whenever the host reads them -
  // every change to them is accompanied by an `onTasksChange`, which is the host's cue
  // to re-render its toolbar
  const historyApi = useMemo<GanttHistoryApi>(
    () => ({
      undo,
      redo,
      get canUndo() {
        return storeApi.getState().history.past.length > 0;
      },
      get canRedo() {
        return storeApi.getState().history.future.length > 0;
      },
    }),
    [undo, redo, storeApi]
  );

  return { historyApi, onKeyDown };
}
