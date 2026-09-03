import { Dayjs } from "dayjs";
import { GanttDragBounds, GanttDragMode, GanttScaleKey } from "shared/types";
import {
  GanttInteractionConfig,
  normalizeProgress,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import { GanttRow } from "rows/utils/grouping";
import { clampDragDates, clampMoveDelta, shiftByDragSteps } from "timeline/utils/geometry";
import { collectSubtreeIds } from "core/tree";

// One `+`/`-` press moves the progress by this many percentage points
const PROGRESS_STEP = 5;

// Which cell of which row has the roving tabindex
export interface GanttFocus {
  row: number;
  col: number;
}

// What the navigation math needs to know about one row
export interface GanttKeyboardRow {
  // Focusable cells in the row
  cells: number;
  // Cell index the bars start at (equal to `cells` when the row has none)
  firstBarCell: number;
  expandable: boolean;
  expanded: boolean;
}

type GanttKeyAction =
  | { kind: "focus"; focus: GanttFocus }
  | { kind: "toggle"; row: number; col: number }
  // Enter/Space on a row that cannot be expanded
  | { kind: "activate"; row: number; col: number }
  | { kind: "delete"; row: number; col: number }
  // Move or resize by whole drag steps
  | { kind: "nudge"; row: number; col: number; mode: GanttDragMode; steps: number }
  | { kind: "progress"; row: number; col: number; delta: number }
  // Move the row among its siblings - negative is up, positive down
  | { kind: "reorder"; row: number; col: number; delta: -1 | 1 }
  // Change the row's parent - negative outdents, positive indents
  | { kind: "reparent"; row: number; col: number; direction: -1 | 1 }
  // Step the timeline scale - negative is finer, positive coarser
  | { kind: "zoom"; direction: number };

// The parts of a keyboard event the resolver reads
interface GanttKeyEvent {
  key: string;
  altKey?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

const clamp = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

// The chart's whole keyboard map; null for a key it does not handle, so the event is left alone.
export function resolveKeyboardAction(
  event: GanttKeyEvent,
  focus: GanttFocus,
  rows: GanttKeyboardRow[]
): GanttKeyAction | null {
  const row = rows[focus.row];
  if (!row) return null;

  const lastRow = rows.length - 1;
  const col = clamp(focus.col, row.cells - 1);
  const step = event.key === "ArrowRight" ? 1 : -1;
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";

  // Editing first: a modifier turns the horizontal arrows into an edit, not navigation
  if (horizontal && (event.altKey || event.shiftKey)) {
    const mode: GanttDragMode = event.altKey
      ? event.shiftKey
        ? "left"
        : "bar"
      : "right";
    return { kind: "nudge", row: focus.row, col, mode, steps: step };
  }

  // Also before navigation: without this, alt+ArrowDown reads as a plain focus move
  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    return {
      kind: "reorder",
      row: focus.row,
      col,
      delta: event.key === "ArrowDown" ? 1 : -1,
    };
  }

  if (horizontal && (event.ctrlKey || event.metaKey)) {
    return { kind: "reparent", row: focus.row, col, direction: step };
  }

  // Zoom before navigation: the modifier changes what the arrow means
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "ArrowUp" || event.key === "ArrowDown")
  ) {
    return { kind: "zoom", direction: event.key === "ArrowUp" ? -1 : 1 };
  }

  switch (event.key) {
    case "ArrowDown":
      return {
        kind: "focus",
        focus: { row: Math.min(focus.row + 1, lastRow), col },
      };

    case "ArrowUp":
      return {
        kind: "focus",
        focus: { row: Math.max(focus.row - 1, 0), col },
      };

    case "ArrowRight":
      if (col === 0 && row.expandable && !row.expanded) {
        return { kind: "toggle", row: focus.row, col };
      }
      return {
        kind: "focus",
        focus: { row: focus.row, col: clamp(col + 1, row.cells - 1) },
      };

    case "ArrowLeft":
      if (col === 0 && row.expandable && row.expanded) {
        return { kind: "toggle", row: focus.row, col };
      }
      return {
        kind: "focus",
        focus: { row: focus.row, col: clamp(col - 1, row.cells - 1) },
      };

    case "Home":
      return event.ctrlKey || event.metaKey
        ? { kind: "focus", focus: { row: 0, col: 0 } }
        : { kind: "focus", focus: { row: focus.row, col: 0 } };

    case "End": {
      const target = event.ctrlKey || event.metaKey ? lastRow : focus.row;
      return {
        kind: "focus",
        focus: { row: target, col: Math.max((rows[target]?.cells ?? 1) - 1, 0) },
      };
    }

    case "Enter":
    case " ":
      return row.expandable
        ? { kind: "toggle", row: focus.row, col }
        : { kind: "activate", row: focus.row, col };

    case "Delete":
    case "Backspace":
      return { kind: "delete", row: focus.row, col };

    case "+":
    case "=":
      return { kind: "progress", row: focus.row, col, delta: PROGRESS_STEP };

    case "-":
    case "_":
      return { kind: "progress", row: focus.row, col, delta: -PROGRESS_STEP };

    default:
      return null;
  }
}

// The task a focused cell acts on - the row's first when the focus is on a list cell
export function taskAtFocus(
  row: GanttRow | undefined,
  col: number,
  firstBarCell: number
): TaskTransformed | undefined {
  if (!row || !row.tasks.length) return undefined;
  return row.tasks[Math.max(0, col - firstBarCell)] ?? row.tasks[0];
}

// The bar's spoken name, e.g. "Design phase, Mar 3 to Mar 14, 40% complete"
export function formatTaskAriaLabel(
  task: Pick<
    TaskTransformed,
    "name" | "startDate" | "endDate" | "isSummary"
  >,
  format: (date: Dayjs) => string,
  progress: number | null = null
): string {
  const parts = [task.name];

  if (task.isSummary) parts.push("summary");
  parts.push(
    `${format(dayjs(task.startDate))} to ${format(dayjs(task.endDate))}`
  );

  if (progress !== null) parts.push(`${progress}% complete`);
  return parts.join(", ");
}

// What a keyboard move did; `position` is 1-based, the way `aria-posinset` counts.
export function formatMovedAnnouncement(
  name: string,
  position: number,
  total: number,
  parentName: string | null
): string {
  const where = parentName ? `under ${parentName}` : "at the top level";
  return `${name} moved to ${position} of ${total} ${where}`;
}

// ARIA attributes of a treegrid row - spread straight onto the element
interface GanttRowAria {
  role: "row";
  "aria-level": number;
  "aria-posinset": number;
  "aria-setsize": number;
  "aria-rowindex": number;
  "aria-expanded"?: boolean;
  // The row's bars live in the timeline subtree - aria-owns makes the two panes one widget
  "aria-owns"?: string;
}

export function rowAriaProps(
  row: GanttRow,
  rowIndex: number,
  options: {
    // 1 when a column header row sits above the data rows, otherwise 0
    headerOffset: number;
    expandable: boolean;
    expanded: boolean;
    // Element ids of the bars belonging to this row
    ownedIds?: string[];
  }
): GanttRowAria {
  return {
    role: "row",
    "aria-level": row.level,
    "aria-posinset": row.posinset,
    "aria-setsize": row.setsize,
    "aria-rowindex": rowIndex + 1 + options.headerOffset,
    ...(options.expandable ? { "aria-expanded": options.expanded } : null),
    ...(options.ownedIds?.length
      ? { "aria-owns": options.ownedIds.join(" ") }
      : null),
  };
}

// Parses the bound props into dayjs, or null when neither end is set
function toDragBounds(
  min: string | undefined,
  max: string | undefined
): GanttDragBounds | null {
  if (!min && !max) return null;
  return { min: min ? dayjs(min) : undefined, max: max ? dayjs(max) : undefined };
}

// Moves or resizes a task by whole drag steps under drag rules; null when nothing may or did change.
export function nudgeTaskDates(
  rawTasks: Task[],
  target: TaskTransformed,
  mode: GanttDragMode,
  steps: number,
  scaleKey: GanttScaleKey,
  interaction?: GanttInteractionConfig
): Task[] | null {
  const { canMove, canResize, minDate, maxDate } = resolveTaskInteraction(
    target,
    interaction
  );
  if (mode === "bar" ? !canMove : !canResize) return null;
  if (!steps) return null;

  const movingIds = new Set(
    target.isSummary && mode === "bar"
      ? collectSubtreeIds(rawTasks, target.id)
      : [target.id]
  );
  const bounds = toDragBounds(minDate, maxDate);

  // The dates on screen - for a summary, the ones rolled up from its children
  const initialStart = dayjs(target.startDate);
  const initialEnd = dayjs(target.endDate);
  let startDate = mode === "right" ? initialStart : shiftByDragSteps(initialStart, steps, scaleKey);
  let endDate = mode === "left" ? initialEnd : shiftByDragSteps(initialEnd, steps, scaleKey);

  let deltaMs: number | null = null;

  if (mode === "bar") {
    const members: { start: Dayjs; end: Dayjs; bounds: GanttDragBounds }[] = [];
    for (const task of rawTasks) {
      if (!movingIds.has(task.id)) continue;

      const member = resolveTaskInteraction(task, interaction);
      const own =
        task.id === target.id
          ? bounds
          : toDragBounds(member.minDate, member.maxDate);
      if (!own) continue;

      members.push({
        start: task.id === target.id ? initialStart : dayjs(task.startDate),
        end: task.id === target.id ? initialEnd : dayjs(task.endDate),
        bounds: own,
      });
    }

    if (members.length) {
      deltaMs = clampMoveDelta(
        members,
        startDate.valueOf() - initialStart.valueOf(),
        scaleKey
      );
      if (deltaMs === 0) return null;

      startDate = initialStart.add(deltaMs, "millisecond");
      endDate = initialEnd.add(deltaMs, "millisecond");
    }
  } else if (bounds) {
    const clamped = clampDragDates(mode, startDate, endDate, bounds, scaleKey);
    startDate = clamped.startDate;
    endDate = clamped.endDate;
  }

  // A resize never folds the bar over - shrinking past one drag step is refused
  if (mode !== "bar" && !endDate.isAfter(startDate)) return null;
  if (
    (mode === "left" && startDate.valueOf() === initialStart.valueOf()) ||
    (mode === "right" && endDate.valueOf() === initialEnd.valueOf())
  ) {
    return null;
  }

  const shift = (iso: string) =>
    deltaMs !== null
      ? dayjs(iso).add(deltaMs, "millisecond").toISOString()
      : shiftByDragSteps(dayjs(iso), steps, scaleKey).toISOString();

  return rawTasks.map((task) => {
    if (!movingIds.has(task.id)) return task;

    switch (mode) {
      case "bar":
        return {
          ...task,
          startDate: shift(task.startDate),
          endDate: shift(task.endDate),
        };
      case "left":
        return { ...task, startDate: startDate.toISOString() };
      default:
        return { ...task, endDate: endDate.toISOString() };
    }
  });
}

// Steps a task's progress; null when progress editing is not allowed or the value would not move
export function stepTaskProgress(
  rawTasks: Task[],
  target: TaskTransformed,
  delta: number,
  interaction?: GanttInteractionConfig
): Task[] | null {
  if (!resolveTaskInteraction(target, interaction).canChangeProgress) return null;

  const current = normalizeProgress(target.progress);
  if (current === null) return null;

  const next = Math.min(100, Math.max(0, current + delta));
  if (next === current) return null;

  return rawTasks.map((task) =>
    task.id === target.id ? { ...task, progress: next } : task
  );
}

// Removes a task and its subtree - orphans would move to the root; null when read-only or absent.
export function deleteTask(
  rawTasks: Task[],
  target: TaskTransformed,
  interaction?: GanttInteractionConfig
): Task[] | null {
  if (!resolveTaskInteraction(target, interaction).canMove) return null;

  const removed = new Set(collectSubtreeIds(rawTasks, target.id));
  if (!removed.size) return null;

  const remaining = rawTasks.filter((task) => !removed.has(task.id));
  return remaining.length === rawTasks.length ? null : remaining;
}
