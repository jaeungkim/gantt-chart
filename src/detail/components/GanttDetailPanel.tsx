import { useEffect, useMemo, useRef } from "react";
import dayjs from "core/dates";
import {
  GanttDetailRenderer,
  GanttLocaleOptions,
  GanttScaleKey,
} from "shared/types";
import { normalizeProgress, TaskTransformed } from "shared/task";
import { resolveFormatters } from "shared/utils/i18n";

interface GanttDetailPanelProps {
  task: TaskTransformed;
  scale: GanttScaleKey;
  localeOptions?: GanttLocaleOptions;
  onClose: () => void;
  /** Replaces the body; the panel element itself, and its width, stay the chart's */
  render?: GanttDetailRenderer;
}

/** The docked panel on the right */
// A sibling of `.gantt-main`, not a layer over it, so width-based scroll and zoom math stays correct.
// `complementary` and not a dialog on purpose - the chart behind it stays interactive.
export default function GanttDetailPanel({
  task,
  scale,
  localeOptions,
  onClose,
  render,
}: GanttDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  // Restore focus on unmount only, and only while focus is still ours (in the panel, on <body>,
  // or nowhere) - the panel can close while the user is typing elsewhere on the host's page.
  const returnFocusRef = useRef<Element | null>(null);
  useEffect(() => {
    // Read once, here: by cleanup time React has already detached the ref
    const panel = panelRef.current;
    returnFocusRef.current = document.activeElement;
    return () => {
      const active = document.activeElement;
      const ours =
        active === null ||
        active === document.body ||
        (panel?.contains(active) ?? false);
      if (!ours) return;

      const previous = returnFocusRef.current;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  // Document-level: focus can sit on <body> or outside the chart, where a React handler on the
  // chart's own tree would never see the keydown.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const { tooltip } = useMemo(
    () => resolveFormatters(scale, localeOptions),
    [scale, localeOptions]
  );

  const progress = normalizeProgress(task.progress);

  return (
    <aside
      ref={panelRef}
      className="gantt-detail"
      role="complementary"
      aria-label="Task details"
    >
      {render ? (
        render({ task, close: onClose, scale })
      ) : (
        <>
          <div className="gantt-detail-header">
            <h2 className="gantt-detail-title">{task.name}</h2>
            <button
              type="button"
              className="gantt-detail-close"
              onClick={onClose}
              aria-label="Close task details"
            >
              ✕
            </button>
          </div>

          <p className="gantt-detail-meta">
            {tooltip(dayjs(task.startDate))} → {tooltip(dayjs(task.endDate))}
            {progress !== null && ` · ${progress}%`}
          </p>
        </>
      )}
    </aside>
  );
}
