import { useCallback, useMemo, useState } from "react";
import { GanttDetailTrigger } from "shared/types";
import { TaskTransformed } from "shared/task";

type TaskMouseHandler = (task: TaskTransformed, event: React.MouseEvent) => void;

type GanttDetailEvent = "click" | "doubleClick";

/** The open task id an interaction produces, or `undefined` for "leave it alone" */
// `"selection"` answers to the click, not the selection: `select` returns early on an unchanged id.
export function detailIdAfter(
  event: GanttDetailEvent,
  trigger: GanttDetailTrigger,
  enabled: boolean,
  taskId: string
): string | undefined {
  if (!enabled) return undefined;
  if (event === "click") return trigger === "selection" ? taskId : undefined;
  return trigger === "doubleClick" ? taskId : undefined;
}

interface ResolvedDetailState<T extends { id: string }> {
  // The id the panel is open on, before it is checked against the data
  openId: string | null;
  // The task to render, or null when the panel is closed or the id is unknown
  task: T | null;
  // An open id naming no task; the panel closes by derivation, without firing `onDetailChange`
  stale: boolean;
}

// `openId` cannot use `??`: `detailTaskId={null}` means "controlled, and closed", not "uncontrolled".
export function resolveDetailState<T extends { id: string }>({
  enabled,
  detailTaskId,
  uncontrolled,
  tasks,
}: {
  enabled: boolean;
  detailTaskId?: string | null;
  uncontrolled: string | null;
  tasks: T[];
}): ResolvedDetailState<T> {
  if (!enabled) return { openId: null, task: null, stale: false };

  const openId = detailTaskId !== undefined ? detailTaskId : uncontrolled;
  if (openId === null) return { openId: null, task: null, stale: false };

  const task = tasks.find((entry) => entry.id === openId) ?? null;
  return { openId, task, stale: task === null };
}

interface UseGanttDetailParams {
  // Whether the panel exists at all - `showDetail ?? renderDetail !== undefined`
  enabled: boolean;
  trigger: GanttDetailTrigger;
  // Every task, collapsed ones included, so collapsing a parent hides the row but not its panel
  tasks: TaskTransformed[];
  // Controlled open task; `undefined` leaves the hook holding its own state
  detailTaskId?: string | null;
  onDetailChange?: (task: TaskTransformed | null) => void;
  // The chart's own click handlers - chained, not replaced
  onTaskClick?: TaskMouseHandler;
  onTaskDoubleClick?: TaskMouseHandler;
}

interface GanttDetail {
  // The task the panel renders, or null while it is closed
  task: TaskTransformed | null;
  // Opens the panel on a task id; an unknown id is ignored
  open: (taskId: string) => void;
  close: () => void;
  onTaskClick: TaskMouseHandler;
  onTaskDoubleClick: TaskMouseHandler;
}

/** Controlled by `detailTaskId`, uncontrolled without it; `onDetailChange` fires in both modes */
export function useGanttDetail({
  enabled,
  trigger,
  tasks,
  detailTaskId,
  onDetailChange,
  onTaskClick,
  onTaskDoubleClick,
}: UseGanttDetailParams): GanttDetail {
  const [uncontrolled, setUncontrolled] = useState<string | null>(null);
  const controlled = detailTaskId !== undefined;

  const { openId, task } = useMemo(
    () => resolveDetailState({ enabled, detailTaskId, uncontrolled, tasks }),
    [enabled, detailTaskId, uncontrolled, tasks]
  );

  const commit = useCallback(
    (nextId: string | null) => {
      if (!enabled) return;
      if (nextId === openId) return;

      if (!controlled) setUncontrolled(nextId);
      onDetailChange?.(
        nextId ? (tasks.find((entry) => entry.id === nextId) ?? null) : null
      );
    },
    [enabled, openId, controlled, onDetailChange, tasks]
  );

  const open = useCallback(
    (taskId: string) => {
      if (!tasks.some((entry) => entry.id === taskId)) return;
      commit(taskId);
    },
    [commit, tasks]
  );

  const close = useCallback(() => commit(null), [commit]);

  const handleClick = useCallback<TaskMouseHandler>(
    (clicked, event) => {
      onTaskClick?.(clicked, event);
      const next = detailIdAfter("click", trigger, enabled, clicked.id);
      if (next !== undefined) commit(next);
    },
    [onTaskClick, trigger, enabled, commit]
  );

  const handleDoubleClick = useCallback<TaskMouseHandler>(
    (clicked, event) => {
      onTaskDoubleClick?.(clicked, event);
      const next = detailIdAfter("doubleClick", trigger, enabled, clicked.id);
      if (next !== undefined) commit(next);
    },
    [onTaskDoubleClick, trigger, enabled, commit]
  );

  return {
    task,
    open,
    close,
    onTaskClick: handleClick,
    onTaskDoubleClick: handleDoubleClick,
  };
}
