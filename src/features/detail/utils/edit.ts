// Edit rules for the built-in detail panel body - pure, so they test without a DOM.
import { Dayjs } from "dayjs";
import dayjs from "core/dates";
import {
  GanttInteractionConfig,
  normalizeProgress,
  resolveTaskInteraction,
  Task,
} from "shared/task";

export type DetailEditableField = "name" | "startDate" | "endDate" | "progress";

interface DetailEditability {
  name: boolean;
  /** One flag for both dates - changing either one is a resize */
  dates: boolean;
  progress: boolean;
}

// The panel adds no flags of its own: dates follow `canResize` (so summary rows stay plain text),
// progress follows `canChangeProgress`. The name has no gesture, so only the readOnly rungs speak.
export function resolveDetailEditability(
  task: Task & { isSummary?: boolean },
  config?: GanttInteractionConfig
): DetailEditability {
  const { canResize, canChangeProgress } = resolveTaskInteraction(task, config);
  return {
    name: !(task.readOnly ?? config?.readOnly ?? false),
    dates: canResize,
    progress: canChangeProgress,
  };
}

// Replaces the date part of `iso`, keeping its time-of-day; null when `value` is not a full date
function mergeDatePart(iso: string, value: string): Dayjs | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const merged = dayjs(`${value}T${dayjs(iso).format("HH:mm:ss.SSS")}`);
  return merged.isValid() ? merged : null;
}

const clampToBounds = (date: Dayjs, min?: string, max?: string): Dayjs => {
  if (min && date.isBefore(dayjs(min))) return dayjs(min);
  if (max && date.isAfter(dayjs(max))) return dayjs(max);
  return date;
};

/** Turns one field's raw input into a patch; null means the value cannot commit and the field reverts */
export function resolveFieldPatch(
  task: Task,
  field: DetailEditableField,
  value: string,
  config?: GanttInteractionConfig
): Partial<Omit<Task, "id">> | null {
  switch (field) {
    case "name":
      return value.trim() === "" ? null : { name: value };
    case "progress": {
      // `Number('')` is 0, so an emptied field must revert before the cast
      const progress =
        value.trim() === "" ? null : normalizeProgress(Number(value));
      return progress === null ? null : { progress };
    }
    default: {
      const { minDate, maxDate } = resolveTaskInteraction(task, config);
      const edited = mergeDatePart(task[field], value);
      if (edited === null) return null;

      const clamped = clampToBounds(edited, minDate, maxDate);
      const start = field === "startDate" ? clamped : dayjs(task.startDate);
      const end = field === "endDate" ? clamped : dayjs(task.endDate);
      // Same refusal as a resize drag: the bar never folds over
      if (!end.isAfter(start)) return null;

      return { [field]: clamped.toISOString() };
    }
  }
}

export function applyTaskPatch(
  rawTasks: Task[],
  taskId: string,
  patch: Partial<Omit<Task, "id">>
): Task[] {
  return rawTasks.map((task) =>
    task.id === taskId ? { ...task, ...patch } : task
  );
}

// The exact commit path every gesture uses (see commitEdit in useGanttKeyboardNav).
// Typed structurally so tests can hand in a stub instead of a full store.
export function commitDetailPatch(
  storeApi: {
    getState: () => { rawTasks: Task[]; setRawTasks: (tasks: Task[]) => void };
  },
  taskId: string,
  patch: Partial<Omit<Task, "id">>,
  onTasksChange?: (tasks: Task[]) => void
): void {
  const { rawTasks, setRawTasks } = storeApi.getState();
  const updated = applyTaskPatch(rawTasks, taskId, patch);
  setRawTasks(updated);
  onTasksChange?.(updated);
}
