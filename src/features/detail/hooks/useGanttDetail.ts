import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskTransformed } from "shared/task";

type TaskMouseHandler = (task: TaskTransformed, event: React.MouseEvent) => void;

interface ResolvedDetailState<T extends { id: string }> {
  // The id the panel is open on, before it is checked against the data
  openId: string | null;
  // The task to render, or null when the panel is closed or the id is unknown; an unknown id
  // closes the panel by derivation, without firing `onDetailChange`
  task: T | null;
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
  if (!enabled) return { openId: null, task: null };

  const openId = detailTaskId !== undefined ? detailTaskId : uncontrolled;
  if (openId === null) return { openId: null, task: null };

  const task = tasks.find((entry) => entry.id === openId) ?? null;
  return { openId, task };
}

interface UseGanttDetailParams {
  // Whether the panel exists at all - `showDetail ?? renderDetail !== undefined`
  enabled: boolean;
  // Every task, collapsed ones included, so collapsing a parent hides the row but not its panel
  tasks: TaskTransformed[];
  // Controlled open task; `undefined` leaves the hook holding its own state
  detailTaskId?: string | null;
  onDetailChange?: (task: TaskTransformed | null) => void;
  onTaskActivate?: TaskMouseHandler;
}

interface GanttDetail {
  // The task the panel renders, or null while it is closed
  task: TaskTransformed | null;
  // Opens the panel on a task id; an unknown id is ignored
  open: (taskId: string) => void;
  close: () => void;
  onTaskActivate: TaskMouseHandler;
}

/** Controlled by `detailTaskId`, uncontrolled without it; `onDetailChange` fires in both modes */
// The panel answers to the click, not to the selection: `select` returns early on an unchanged id,
// so a panel driven by the selection would stay shut after Escape however often the row was clicked.
export function useGanttDetail({
  enabled,
  tasks,
  detailTaskId,
  onDetailChange,
  onTaskActivate,
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
      onTaskActivate?.(clicked, event);
      commit(clicked.id);
    },
    [onTaskActivate, commit]
  );

  return { task, open, close, onTaskActivate: handleClick };
}

// Headroom over the 200ms flex-basis transition in styles.css; a transitionend would be
// tighter, but the browser never fires one for a display: none ancestor or an interrupted slide
const CLOSE_MS = 400;

interface GanttDetailSlide {
  /** The task to keep rendered - the open one, or the last one while the panel slides shut */
  task: TaskTransformed | null;
  /** Drives .gantt-detail-open - false on the mount frame so opening transitions up from zero */
  open: boolean;
}

/** Holds the panel mounted through the slide-closed transition, then releases it */
export function useGanttDetailSlide(
  task: TaskTransformed | null
): GanttDetailSlide {
  const [retained, setRetained] = useState(task);
  const [open, setOpen] = useState(false);

  // Render-phase sync, so the body never shows a stale task while one is open
  if (task !== null && task !== retained) setRetained(task);

  const opening = task !== null;
  useEffect(() => {
    // Two frames on open: the first paints the closed basis the transition starts from
    let raf = requestAnimationFrame(() => {
      if (!opening) {
        setOpen(false);
        return;
      }
      raf = requestAnimationFrame(() => setOpen(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [opening]);

  useEffect(() => {
    if (opening || retained === null) return;
    const id = setTimeout(() => setRetained(null), CLOSE_MS);
    return () => clearTimeout(id);
  }, [opening, retained]);

  return { task: retained, open };
}
