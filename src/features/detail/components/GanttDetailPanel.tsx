import { CSSProperties, useCallback, useEffect, useState } from "react";
import dayjs from "core/dates";
import { useGanttStoreApi } from "shared/context";
import { useLatestRef } from "shared/hooks/useLatestRef";
import {
  GanttDetailRenderer,
  GanttFormatters,
  GanttScaleKey,
} from "shared/types";
import {
  GanttInteractionConfig,
  normalizeProgress,
  resolveTaskColors,
  Task,
  TaskTransformed,
} from "shared/task";
import { formatDuration } from "shared/utils/i18n";
import {
  DetailEditableField,
  resolveDetailEditability,
  resolveFieldPatch,
} from "features/detail/utils/edit";
import { LINK_TYPE_TITLE } from "features/dependencies/utils/link";

interface GanttDetailPanelProps {
  task: TaskTransformed;
  tasks: TaskTransformed[];
  scale: GanttScaleKey;
  tooltip: GanttFormatters["tooltip"];
  interaction?: GanttInteractionConfig;
  onClose: () => void;
  onTasksChange?: (updatedTasks: Task[]) => void;
  render?: GanttDetailRenderer;
  open: boolean;
}

interface DetailInputProps {
  className: string;
  type: "text" | "date";
  value: string;
  commit: (value: string) => void;
  "aria-label"?: string;
}

function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value);

  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  return [draft, setDraft] as const;
}

function DetailInput({ value, commit, ...rest }: DetailInputProps) {
  const [draft, setDraft] = useDraft(value);

  const submit = () => {
    if (draft !== value) commit(draft);
    setDraft(value);
  };

  return (
    <input
      {...rest}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setDraft(value);
        }
      }}
    />
  );
}

function ProgressField({
  value,
  editable,
  colors,
  commit,
}: {
  value: number;
  editable: boolean;
  colors: CSSProperties;
  commit: (value: string) => void;
}) {
  const [draft, setDraft] = useDraft(value);

  const submit = () => {
    if (draft !== value) commit(String(draft));
  };

  const style = { ...colors, "--gantt-detail-progress": `${draft}%` } as CSSProperties;

  return (
    <label className="gantt-detail-section">
      <span className="gantt-detail-row">
        <span className="gantt-detail-label">Progress</span>
        <span className="gantt-detail-meta">{draft}%</span>
      </span>
      {editable ? (
        <input
          className="gantt-detail-progress"
          type="range"
          min={0}
          max={100}
          step={1}
          value={draft}
          style={style}
          onChange={(event) => setDraft(Number(event.target.value))}
          onPointerUp={submit}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setDraft(value);
          }}
          onKeyUp={submit}
          onBlur={submit}
        />
      ) : (
        <span className="gantt-detail-progress" style={style} />
      )}
    </label>
  );
}

export default function GanttDetailPanel({
  task,
  tasks,
  scale,
  tooltip,
  interaction,
  onClose,
  onTasksChange,
  render,
  open,
}: GanttDetailPanelProps) {
  const storeApi = useGanttStoreApi();
  const closeRef = useLatestRef(onClose);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeRef.current();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeRef]);

  const update = useCallback(
    (patch: Partial<Omit<Task, "id">>) => {
      const { rawTasks, setRawTasks } = storeApi.getState();
      const updated = rawTasks.map((entry) =>
        entry.id === task.id ? { ...entry, ...patch } : entry
      );
      setRawTasks(updated);
      onTasksChange?.(updated);
    },
    [storeApi, task.id, onTasksChange]
  );

  const commitField = (field: DetailEditableField, value: string) => {
    const patch = resolveFieldPatch(task, field, value, interaction);
    if (patch) update(patch);
  };

  const editable = resolveDetailEditability(task, interaction);
  const progress = normalizeProgress(task.progress);
  const start = dayjs(task.startDate);
  const end = dayjs(task.endDate);
  const dependencies = (task.dependencies ?? []).map((dep) => ({
    ...dep,
    name: tasks.find((entry) => entry.id === dep.targetId)?.name ?? dep.targetId,
  }));

  return (
    <aside className={open ? "gantt-detail gantt-detail-open" : "gantt-detail"}>
      {render ? (
        render({ task, close: onClose, scale, update })
      ) : (
        <>
          <header className="gantt-detail-header">
            {editable.name ? (
              <DetailInput
                className="gantt-detail-title"
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
              title="Close"
              aria-label="Close"
              onClick={onClose}
            >
              <svg viewBox="0 0 16 16">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>

          <section className="gantt-detail-section">
            <span className="gantt-detail-row">
              <span className="gantt-detail-label">Dates</span>
              <span className="gantt-detail-meta">
                {formatDuration(end.valueOf() - start.valueOf())}
              </span>
            </span>
            <span className="gantt-detail-dates">
              {(["startDate", "endDate"] as const).map((field) => (
                <label key={field} className="gantt-detail-field">
                  <span className="gantt-detail-sublabel">
                    {field === "startDate" ? "Start" : "End"}
                  </span>
                  {editable.dates ? (
                    <DetailInput
                      className="gantt-detail-input"
                      type="date"
                      value={dayjs(task[field]).format("YYYY-MM-DD")}
                      commit={(next) => commitField(field, next)}
                    />
                  ) : (
                    <span className="gantt-detail-value">
                      {tooltip(field === "startDate" ? start : end)}
                    </span>
                  )}
                </label>
              ))}
            </span>
          </section>

          {progress !== null && (
            <ProgressField
              value={progress}
              editable={editable.progress}
              colors={resolveTaskColors(task.color) as CSSProperties}
              commit={(next) => commitField("progress", next)}
            />
          )}

          {dependencies.length > 0 && (
            <section className="gantt-detail-section">
              <span className="gantt-detail-label">Depends on</span>
              <ul className="gantt-detail-deps">
                {dependencies.map(({ targetId, type, name }) => (
                  <li key={targetId}>
                    <span className="gantt-detail-badge" title={LINK_TYPE_TITLE[type]}>
                      {type}
                    </span>
                    <span className="gantt-detail-dep-name">{name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </aside>
  );
}
