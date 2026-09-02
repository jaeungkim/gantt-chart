import { Virtualizer } from "@tanstack/react-virtual";
import { RefObject, useCallback, useEffect, useMemo, useState } from "react";
import { GanttScrollApi } from "hooks/useGanttScrollApi";
import { useGanttStoreApi } from "stores/context";
import { GanttLocaleOptions, GanttScaleKey } from "types/gantt";
import { GanttInteractionConfig, Task } from "types/task";
import {
  deleteTask,
  formatTaskAriaLabel,
  GanttFocus,
  GanttKeyboardRow,
  nudgeTaskDates,
  resolveKeyboardAction,
  stepTaskProgress,
  taskAtFocus,
} from "utils/a11y";
import { GanttRow, isRowExpandable } from "utils/grouping";
import { resolveFormatters } from "utils/i18n";
import dayjs from "core/dates";

/**
 * How many frames a keyboard move waits for its target row to be rendered
 *
 * A row scrolled out of the virtualized window has no element yet, so the move
 * scrolls it into view and retries - three frames is enough for the virtualizer to
 * commit, and gives up rather than spinning if the row never appears.
 */
const FOCUS_RETRY_FRAMES = 3;

interface UseGanttKeyboardNavParams {
  rows: GanttRow[];
  rawTasks: Task[];
  /** Cells before the bars on a row - 0 while the task list is hidden */
  gridColumnCount: number;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  selectedScale: GanttScaleKey;
  localeOptions: GanttLocaleOptions | undefined;
  interaction: GanttInteractionConfig;
  onToggleCollapse: (rowId: string) => void;
  onTasksChange?: (updatedTasks: Task[]) => void;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  scrollApi: GanttScrollApi;
  /** The treegrid element - the focus manager looks its cells up inside it */
  bodyRef: RefObject<HTMLDivElement | null>;
}

export interface GanttKeyboardNav {
  /** The cell that carries the roving tabindex, clamped to the rows that exist */
  focus: GanttFocus;
  /** Text for the live region - what a keyboard edit just did */
  announcement: string;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocusCapture: (event: React.FocusEvent<HTMLDivElement>) => void;
}

/**
 * One roving tabindex across both panes
 *
 * The chart is a single tab stop, and every move, resize, expand and delete is
 * reachable from the keyboard, so no part of it depends on being able to drag.
 * A keyboard edit is a gesture like a drag: it commits through `commitTasks` and is
 * one undo step.
 */
export function useGanttKeyboardNav({
  rows,
  rawTasks,
  gridColumnCount,
  hierarchy,
  collapsedIds,
  selectedScale,
  localeOptions,
  interaction,
  onToggleCollapse,
  onTasksChange,
  rowVirtualizer,
  scrollApi,
  bodyRef,
}: UseGanttKeyboardNavParams): GanttKeyboardNav {
  const storeApi = useGanttStoreApi();
  const [focus, setFocus] = useState<GanttFocus>({ row: 0, col: 0 });
  // Bumped on every keyboard move; the focus effect keys off it so a move that
  // lands on the same cell (after an edit re-render) still restores focus
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
      storeApi.getState().commitTasks(updated);
      onTasksChange?.(updated);
    },
    [storeApi, onTasksChange]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const action = resolveKeyboardAction(event, safeFocus, keyboardRows);
      if (!action) return;

      // Claimed as soon as the key is recognized, before anything is executed:
      // alt+arrow is the browser's own back/forward, so leaving it until after the
      // work would let an early exit navigate the page away
      event.preventDefault();

      const row = rows[action.kind === "focus" ? safeFocus.row : action.row];
      const keyboardRow = keyboardRows[safeFocus.row];
      const task =
        action.kind === "focus"
          ? undefined
          : taskAtFocus(row, action.col ?? 0, keyboardRow?.firstBarCell ?? 0);

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
      }
    },
    [
      safeFocus,
      keyboardRows,
      rows,
      onToggleCollapse,
      rawTasks,
      interaction,
      selectedScale,
      commitEdit,
      announceDate,
    ]
  );

  // Clicking a bar or a cell moves the roving tabindex with it, so the next arrow
  // key continues from where the pointer left off
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

  // Move the DOM focus after a keyboard move
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

      rowVirtualizer.scrollToIndex(safeFocus.row, { align: "auto" });
      const target = rows[safeFocus.row]?.tasks[0];
      if (target) scrollApi.scrollToTask(target.id, { smooth: false });
      frame = requestAnimationFrame(focusCell);
    };

    focusCell();
    return () => cancelAnimationFrame(frame);
    // safeFocus is what focusNonce tracks - depending on it too would refocus on
    // every pointer click as well
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return { focus: safeFocus, announcement, onKeyDown, onFocusCapture };
}
