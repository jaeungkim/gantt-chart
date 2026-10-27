import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGanttStoreApi } from "shared/context";
import { TaskTransformed } from "shared/task";

interface ResolvedDetailState<T extends { id: string }> {
  openId: string | null;
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

  const openId = detailTaskId !== undefined ? detailTaskId : uncontrolled;
  if (openId === null) return { openId: null, task: null };

  const task = tasks.find((entry) => entry.id === openId) ?? null;
  return { openId, task };
}

const holds = (list: { id: string }[], id: string) =>
  list.some((entry) => entry.id === id);

interface UseGanttDetailParams {
  enabled: boolean;
  tasks: TaskTransformed[];
  detailTaskId?: string | null;
  onDetailChange?: (task: TaskTransformed | null) => void;
}

interface GanttDetail {
  task: TaskTransformed | null;
  open: (taskId: string) => void;
  close: () => void;
}

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
      if (holds(storeApi.getState().rawTasks, taskId)) pendingRef.current = taskId;
    },
    [commit, tasks, storeApi]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending === null) return;

    if (holds(tasks, pending)) commit(pending);
    else if (!holds(storeApi.getState().rawTasks, pending)) pendingRef.current = null;
  }, [tasks, commit, storeApi]);

  const close = useCallback(() => commit(null), [commit]);

  return { task, open, close };
}
