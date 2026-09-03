import { useCallback, useMemo, useState } from "react";
import { TaskTransformed } from "shared/task";

type TaskMouseHandler = (task: TaskTransformed, event: React.MouseEvent) => void;

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
  // Every task, collapsed ones included, so collapsing a parent hides the row but not its panel
  tasks: TaskTransformed[];
  // Controlled open task; `undefined` leaves the hook holding its own state
  detailTaskId?: string | null;
  onDetailChange?: (task: TaskTransformed | null) => void;
  // The chart's own click handler - chained, not replaced
  onTaskClick?: TaskMouseHandler;
}

interface GanttDetail {
  // The task the panel renders, or null while it is closed
  task: TaskTransformed | null;
  // Opens the panel on a task id; an unknown id is ignored
  open: (taskId: string) => void;
  close: () => void;
  onTaskClick: TaskMouseHandler;
}

/** Controlled by `detailTaskId`, uncontrolled without it; `onDetailChange` fires in both modes */
// The panel answers to the click, not to the selection: `select` returns early on an unchanged id,
// so a panel driven by the selection would stay shut after Escape however often the row was clicked.
export function useGanttDetail({
  enabled,
  tasks,
  detailTaskId,
  onDetailChange,
  onTaskClick,
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
      commit(clicked.id);
    },
    [onTaskClick, commit]
  );

  return { task, open, close, onTaskClick: handleClick };
}
