import type { ScrollAlign } from "shared/virtual/useVirtualWindow";
import { RefObject, useCallback, useEffect, useMemo, useState } from "react";
import { GanttScrollApi } from "timeline/hooks/useGanttScrollApi";
import { GanttTaskMoveApi } from "task-list/hooks/useGanttTaskMove";
import { useGanttStoreApi } from "shared/context";
import { GanttLocaleOptions, GanttScaleKey } from "shared/types";
import { GanttInteractionConfig, Task, TaskTransformed } from "shared/task";
import {
  deleteTask,
  formatMovedAnnouncement,
  formatTaskAriaLabel,
  GanttFocus,
  GanttKeyboardRow,
  nudgeTaskDates,
  resolveKeyboardAction,
  stepTaskProgress,
  taskAtFocus,
} from "interaction/utils/a11y";
import { GanttRow, isRowExpandable } from "rows/utils/grouping";
import { resolveFormatters } from "shared/utils/i18n";
import { stepScale } from "timeline/utils/viewport";
import dayjs from "core/dates";
import { buildTaskOrder } from "core/reorder";

// A row outside the virtual window has no element yet: scroll it in and retry, then give up
const FOCUS_RETRY_FRAMES = 3;

interface UseGanttKeyboardNavParams {
  rows: GanttRow[];
  rawTasks: Task[];
  // Cells before the bars on a row - 0 while the task list is hidden
  gridColumnCount: number;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  selectedScale: GanttScaleKey;
  localeOptions: GanttLocaleOptions | undefined;
  interaction: GanttInteractionConfig;
  // Enter on a focused row; left out, Enter only announces the row
  onActivate?: (taskId: string) => void;
  onToggleCollapse: (rowId: string) => void;
  onTasksChange?: (updatedTasks: Task[]) => void;
  move: GanttTaskMoveApi;
  // Brings a culled row back into view before the focus lands on it
  scrollToRow: (index: number, align?: ScrollAlign) => void;
  scrollApi: GanttScrollApi;
  // The treegrid element - the focus manager looks its cells up inside it
  bodyRef: RefObject<HTMLDivElement | null>;
}

interface GanttKeyboardNav {
  // The cell that carries the roving tabindex, clamped to the rows that exist
  focus: GanttFocus;
  // Text for the live region - what a keyboard edit just did
  announcement: string;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocusCapture: (event: React.FocusEvent<HTMLDivElement>) => void;
}

// One roving tabindex across both panes; keyboard edits write through `setRawTasks`
export function useGanttKeyboardNav({
  rows,
  rawTasks,
  gridColumnCount,
  hierarchy,
  collapsedIds,
  selectedScale,
  localeOptions,
  interaction,
  onActivate,
  onToggleCollapse,
  onTasksChange,
  move,
  scrollToRow,
  scrollApi,
  bodyRef,
}: UseGanttKeyboardNavParams): GanttKeyboardNav {
  const storeApi = useGanttStoreApi();
  const [focus, setFocus] = useState<GanttFocus>({ row: 0, col: 0 });
  // Bumped on every keyboard move, so a move onto the same cell still restores focus
  const [focusNonce, setFocusNonce] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const safeFocus = useMemo<GanttFocus>(
    () => ({
      row: Math.min(focus.row, Math.max(rows.length - 1, 0)),
      col: focus.col,
    }),
    [focus, rows.length]
  );

  // A group header row is a single full-width cell
  const keyboardRows = useMemo<GanttKeyboardRow[]>(
    () =>
      rows.map((row) => ({
        cells: row.group ? 1 : Math.max(gridColumnCount + row.tasks.length, 1),
        firstBarCell: row.group ? 1 : gridColumnCount,
        expandable: isRowExpandable(row, hierarchy),
        expanded: !collapsedIds.has(row.id),
      })),
    [rows, gridColumnCount, hierarchy, collapsedIds]
  );

  const { tooltip: announceDate } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const commitEdit = useCallback(
    (updated: Task[]) => {
      storeApi.getState().setRawTasks(updated);
      onTasksChange?.(updated);
    },
    [storeApi, onTasksChange]
  );

  // Read back from the store: a move renumbers the forest, so the landing slot is only known after
  const announceMove = useCallback(
    (task: TaskTransformed) => {
      const updated = storeApi.getState().rawTasks;
      const order = buildTaskOrder(updated, hierarchy);
      const parentId = order.parentOf.get(task.id) ?? null;
      const siblings = order.childrenOf(parentId);
      const parent = updated.find((entry) => entry.id === parentId);

      setAnnouncement(
        formatMovedAnnouncement(
          task.name,
          siblings.indexOf(task.id) + 1,
          siblings.length,
          parent?.name ?? null
        )
      );
      // Focus stays on the row index, not the task: the rows only re-derive next render
      setFocusNonce((nonce) => nonce + 1);
    },
    [storeApi, hierarchy]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const action = resolveKeyboardAction(event, safeFocus, keyboardRows);
      if (!action) return;

      // alt+arrow is the browser's back/forward, so claim it before any early exit
      event.preventDefault();

      if (action.kind === "zoom") {
        const next = stepScale(selectedScale, action.direction);
        if (next !== selectedScale) {
          scrollApi.setScale(next);
          setAnnouncement(`${next} scale`);
        }
        return;
      }

      const row = rows[action.kind === "focus" ? safeFocus.row : action.row];
      const keyboardRow = keyboardRows[safeFocus.row];
      const task =
        action.kind === "focus"
          ? undefined
          : taskAtFocus(row, action.col, keyboardRow?.firstBarCell ?? 0);

      switch (action.kind) {
        case "focus":
          setFocus(action.focus);
          setFocusNonce((nonce) => nonce + 1);
          break;

        case "toggle":
          if (row) onToggleCollapse(row.id);
          break;

        case "activate":
          if (task) {
            onActivate?.(task.id);
            setAnnouncement(formatTaskAriaLabel(task, announceDate, null));
          }
          break;

        case "delete": {
          if (!task) return;

          const updated = deleteTask(rawTasks, task, interaction);
          if (!updated) {
            setAnnouncement(`${task.name} cannot be deleted`);
            break;
          }
          commitEdit(updated);
          setAnnouncement(`${task.name} deleted`);
          break;
        }

        case "nudge": {
          if (!task) return;

          const updated = nudgeTaskDates(
            rawTasks,
            task,
            action.mode,
            action.steps,
            selectedScale,
            interaction
          );
          if (!updated) {
            setAnnouncement(`${task.name} cannot be changed`);
            break;
          }

          commitEdit(updated);
          const moved = updated.find((entry) => entry.id === task.id);
          if (moved) {
            setAnnouncement(
              `${task.name}, ${announceDate(dayjs(moved.startDate))} to ${announceDate(dayjs(moved.endDate))}`
            );
          }
          setFocusNonce((nonce) => nonce + 1);
          break;
        }

        case "progress": {
          if (!task) return;

          const updated = stepTaskProgress(
            rawTasks,
            task,
            action.delta,
            interaction
          );
          if (!updated) {
            setAnnouncement(`${task.name} progress cannot be changed`);
            break;
          }

          commitEdit(updated);
          const changed = updated.find((entry) => entry.id === task.id);
          setAnnouncement(`${task.name}, ${changed?.progress ?? 0}% complete`);
          setFocusNonce((nonce) => nonce + 1);
          break;
        }

        case "reorder": {
          if (!task) return;

          const order = buildTaskOrder(rawTasks, hierarchy);
          const parentId = order.parentOf.get(task.id) ?? null;
          const siblings = order.childrenOf(parentId);
          const toIndex = siblings.indexOf(task.id) + action.delta;
          // Either end of the list: nowhere to go, and the core would clamp back onto the same slot
          if (toIndex < 0 || toIndex >= siblings.length) break;

          if (move.apply({ taskId: task.id, toParentId: parentId, toIndex })) {
            announceMove(task);
          }
          break;
        }

        case "reparent": {
          // No hierarchy, no parent to change - the core refuses it anyway
          if (!task || !hierarchy) return;

          const order = buildTaskOrder(rawTasks, hierarchy);
          const parentId = order.parentOf.get(task.id) ?? null;
          const siblings = order.childrenOf(parentId);

          if (action.direction > 0) {
            // Indent: the row above at the same depth adopts it, last
            const adopter = siblings[siblings.indexOf(task.id) - 1];
            if (!adopter) break;

            if (
              move.apply({
                taskId: task.id,
                toParentId: adopter,
                toIndex: order.childrenOf(adopter).length,
              })
            ) {
              announceMove(task);
            }
            break;
          }

          // Outdent: lands directly after the parent it left; at the root there is none to leave
          if (!parentId) break;

          const grandParentId = order.parentOf.get(parentId) ?? null;
          const uncles = order.childrenOf(grandParentId);

          if (
            move.apply({
              taskId: task.id,
              toParentId: grandParentId,
              toIndex: uncles.indexOf(parentId) + 1,
            })
          ) {
            announceMove(task);
          }
          break;
        }
      }
    },
    [
      safeFocus,
      keyboardRows,
      rows,
      onActivate,
      onToggleCollapse,
      rawTasks,
      interaction,
      selectedScale,
      scrollApi,
      commitEdit,
      announceDate,
      hierarchy,
      move,
      announceMove,
    ]
  );

  // A pointer click moves the roving tabindex, so the next arrow key continues from there
  const onFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const coord = event.target
        .closest?.("[data-gantt-cell]")
        ?.getAttribute("data-gantt-cell");
      if (!coord) return;

      const [row, col] = coord.split(":").map(Number);
      setFocus((prev) =>
        prev.row === row && prev.col === col ? prev : { row, col }
      );
    },
    []
  );

  useEffect(() => {
    if (!focusNonce) return;

    let attempts = FOCUS_RETRY_FRAMES;
    let frame = 0;

    const focusCell = () => {
      const cell = bodyRef.current?.querySelector<HTMLElement>(
        `[data-gantt-cell="${safeFocus.row}:${safeFocus.col}"]`
      );
      if (cell) {
        cell.focus({ preventScroll: true });
        cell.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      if (--attempts <= 0) return;

      scrollToRow(safeFocus.row, "auto");
      const target = rows[safeFocus.row]?.tasks[0];
      if (target) scrollApi.scrollToTask(target.id, { smooth: false });
      frame = requestAnimationFrame(focusCell);
    };

    focusCell();
    return () => cancelAnimationFrame(frame);
    // safeFocus is what focusNonce tracks - depending on it too would refocus on every click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return { focus: safeFocus, announcement, onKeyDown, onFocusCapture };
}
