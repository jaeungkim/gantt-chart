import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGanttStoreApi } from "shared/context";
import { TaskTransformed } from "shared/task";

interface ResolvedDetailState<T extends { id: string }> {
  // The id the panel is open on, before it is checked against the data
  openId: string | null;
  // The task to render, or null when the panel is closed or the id is unknown; an unknown id
  // closes the panel by derivation, without firing `onDetailChange`
  task: T | null;
}

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
  if (!enabled) return { openId: null, task: null };

  // Not `??`: `detailTaskId={null}` means "controlled, and closed", not "uncontrolled"
  const openId = detailTaskId !== undefined ? detailTaskId : uncontrolled;
  if (openId === null) return { openId: null, task: null };

  const task = tasks.find((entry) => entry.id === openId) ?? null;
  return { openId, task };
}

const holds = (list: { id: string }[], id: string) =>
  list.some((entry) => entry.id === id);

interface UseGanttDetailParams {
  // Whether the panel exists at all - `showDetail ?? renderDetail !== undefined`
  enabled: boolean;
  // Every task, collapsed ones included, so collapsing a parent hides the row but not its panel
  tasks: TaskTransformed[];
  // Controlled open task; `undefined` leaves the hook holding its own state
  detailTaskId?: string | null;
  onDetailChange?: (task: TaskTransformed | null) => void;
}

interface GanttDetail {
  // The task the panel renders, or null while it is closed
  task: TaskTransformed | null;
  // Opens the panel on a task id; an unknown id is ignored
  open: (taskId: string) => void;
  close: () => void;
}

/** Controlled by `detailTaskId`, uncontrolled without it; `onDetailChange` fires in both modes */
export function useGanttDetail({
  enabled,
  tasks,
  detailTaskId,
  onDetailChange,
}: UseGanttDetailParams): GanttDetail {
  const storeApi = useGanttStoreApi();
  const [uncontrolled, setUncontrolled] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const controlled = detailTaskId !== undefined;

  const { task } = useMemo(
    () => resolveDetailState({ enabled, detailTaskId, uncontrolled, tasks }),
    [enabled, detailTaskId, uncontrolled, tasks]
  );

  // A derived close is final, so a returning task or panel cannot reopen it
  if (!controlled && uncontrolled !== null && task === null) setUncontrolled(null);

  const commit = useCallback(
    (nextId: string | null) => {
      pendingRef.current = null;
      if (!enabled) return;
      if (nextId === (task?.id ?? null)) return;

      if (!controlled) setUncontrolled(nextId);
      onDetailChange?.(
        nextId ? (tasks.find((entry) => entry.id === nextId) ?? null) : null
      );
    },
    [enabled, task, controlled, onDetailChange, tasks]
  );

  const open = useCallback(
    (taskId: string) => {
      if (holds(tasks, taskId)) {
        commit(taskId);
        return;
      }
      // A task the host just added is in the store two renders before `tasks`
      if (holds(storeApi.getState().rawTasks, taskId)) pendingRef.current = taskId;
    },
    [commit, tasks, storeApi]
  );

  // Opens a held task once `tasks` catches up; forgets it if the host removed it first
  useEffect(() => {
    const pending = pendingRef.current;
    if (pending === null) return;

    if (holds(tasks, pending)) commit(pending);
    else if (!holds(storeApi.getState().rawTasks, pending)) pendingRef.current = null;
  }, [tasks, commit, storeApi]);

  const close = useCallback(() => commit(null), [commit]);

  return { task, open, close };
}
