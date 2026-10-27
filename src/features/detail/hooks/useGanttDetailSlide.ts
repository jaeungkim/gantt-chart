import { useEffect, useState } from "react";
import { TaskTransformed } from "shared/task";

const SLIDE_CLOSED_UNMOUNT_MS = 400;

interface GanttDetailSlide {
  task: TaskTransformed | null;
  open: boolean;
}

export function useGanttDetailSlide(
  task: TaskTransformed | null
): GanttDetailSlide {
  const [retained, setRetained] = useState(task);
  const [open, setOpen] = useState(false);

  if (task !== null && task !== retained) setRetained(task);

  const opening = task !== null;
  useEffect(() => {
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
    const id = setTimeout(() => setRetained(null), SLIDE_CLOSED_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [opening, retained]);

  return { task: retained, open };
}
