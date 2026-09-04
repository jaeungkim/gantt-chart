import {
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import dayjs from "core/dates";
import { useGanttStoreApi } from "shared/context";
import {
  GanttDetailRenderer,
  GanttLocaleOptions,
  GanttScaleKey,
} from "shared/types";
import {
  GanttInteractionConfig,
  normalizeProgress,
  Task,
  TaskTransformed,
} from "shared/task";
import { formatDuration, resolveFormatters } from "shared/utils/i18n";
import {
  commitDetailPatch,
  DetailEditableField,
  resolveDetailEditability,
  resolveFieldPatch,
} from "detail/utils/edit";

interface GanttDetailPanelProps {
  task: TaskTransformed;
  /** Every task, so a dependency's target id can be printed by name */
  tasks: TaskTransformed[];
  scale: GanttScaleKey;
  localeOptions?: GanttLocaleOptions;
  /** Gates which built-in fields take input - the same flags the drag gestures obey */
  interaction?: GanttInteractionConfig;
  onClose: () => void;
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Replaces the body; the panel element itself, and its width, stay the chart's */
  render?: GanttDetailRenderer;
  /** False while the panel slides shut - the slide lives in flex-basis, see .gantt-detail */
  open: boolean;
  onTransitionEnd: React.TransitionEventHandler<HTMLElement>;
}

interface DetailInputProps {
  id?: string;
  type: "text" | "date" | "number";
  /** The store's value - the draft resets to it on an external change or a refused commit */
  value: string;
  commit: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  "aria-label"?: string;
}

// Commits on blur and Enter; Escape reverts the draft without closing the panel
function DetailInput({ value, commit, ...rest }: DetailInputProps) {
  const [draft, setDraft] = useState(value);

  // The store value wins whenever it changes - a landed commit, or a drag that moved the task
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const submit = () => {
    if (draft !== value) commit(draft);
    // A landed commit echoes back through `value`; a refused one leaves this as the revert
    setDraft(value);
  };

  return (
    <input
      className="gantt-detail-input"
      {...rest}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") submit();
        if (event.key === "Escape") {
          // stopPropagation at the React root keeps the panel's document-level
          // Escape listener from also closing the panel
          event.stopPropagation();
          setDraft(value);
        }
      }}
    />
  );
}

/** The docked panel on the right */
// A sibling of `.gantt-main`, not a layer over it, so width-based scroll and zoom math stays correct.
// `complementary` and not a dialog on purpose - the chart behind it stays interactive.
export default function GanttDetailPanel({
  task,
  tasks,
  scale,
  localeOptions,
  interaction,
  onClose,
  onTasksChange,
  render,
  open,
  onTransitionEnd,
}: GanttDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const storeApi = useGanttStoreApi();
  const idBase = useId();

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

  const update = useCallback(
    (patch: Partial<Omit<Task, "id">>) =>
      commitDetailPatch(storeApi, task.id, patch, onTasksChange),
    [storeApi, task.id, onTasksChange]
  );

  const commitField = useCallback(
    (field: DetailEditableField, value: string) => {
      const patch = resolveFieldPatch(task, field, value, interaction);
      if (patch) update(patch);
    },
    [task, interaction, update]
  );

  const editable = resolveDetailEditability(task, interaction);
  const progress = normalizeProgress(task.progress);
  const start = dayjs(task.startDate);
  const end = dayjs(task.endDate);
  // Predecessors by name; an id naming no task falls back to the id itself
  const predecessors = (task.dependencies ?? []).map(
    (dep) => tasks.find((entry) => entry.id === dep.targetId)?.name ?? dep.targetId
  );

  const dateInput = (field: "startDate" | "endDate", value: string) => (
    <DetailInput
      id={`${idBase}-${field}`}
      type="date"
      value={dayjs(value).format("YYYY-MM-DD")}
      commit={(next) => commitField(field, next)}
    />
  );

  // Captions are fixed English: the only words the panel prints, and `renderDetail` replaces them
  const fields: { caption: string; value: ReactNode; inputId?: string }[] = [
    editable.dates
      ? {
          caption: "Start",
          inputId: `${idBase}-startDate`,
          value: dateInput("startDate", task.startDate),
        }
      : { caption: "Start", value: tooltip(start) },
    editable.dates
      ? {
          caption: "End",
          inputId: `${idBase}-endDate`,
          value: dateInput("endDate", task.endDate),
        }
      : { caption: "End", value: tooltip(end) },
    { caption: "Duration", value: formatDuration(end.valueOf() - start.valueOf()) },
  ];
  if (progress !== null) {
    fields.push(
      editable.progress
        ? {
            caption: "Progress",
            inputId: `${idBase}-progress`,
            value: (
              <DetailInput
                id={`${idBase}-progress`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={String(progress)}
                commit={(next) => commitField("progress", next)}
              />
            ),
          }
        : { caption: "Progress", value: `${progress}%` }
    );
  }
  if (predecessors.length > 0) {
    fields.push({ caption: "Depends on", value: predecessors.join(", ") });
  }

  return (
    <aside
      ref={panelRef}
      className={open ? "gantt-detail gantt-detail-open" : "gantt-detail"}
      role="complementary"
      aria-label="Task details"
      onTransitionEnd={onTransitionEnd}
    >
      {render ? (
        render({ task, close: onClose, scale, update })
      ) : (
        <>
          <div className="gantt-detail-header">
            {editable.name ? (
              <DetailInput
                type="text"
                aria-label="Task name"
                value={task.name}
                commit={(next) => commitField("name", next)}
              />
            ) : (
              <h2 className="gantt-detail-title">{task.name}</h2>
            )}
            <button
              type="button"
              className="gantt-detail-close"
              onClick={onClose}
              aria-label="Close task details"
            >
              ✕
            </button>
          </div>

          <dl className="gantt-detail-fields">
            {fields.map(({ caption, value, inputId }) => (
              <Fragment key={caption}>
                <dt>
                  {inputId ? <label htmlFor={inputId}>{caption}</label> : caption}
                </dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
          </dl>
        </>
      )}
    </aside>
  );
}
