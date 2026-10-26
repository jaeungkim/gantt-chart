import { useEffect, useState } from "react";
import { TaskTransformed } from "shared/task";

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
