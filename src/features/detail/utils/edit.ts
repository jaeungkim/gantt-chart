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
  dates: boolean;
  progress: boolean;
}

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
      if (!end.isAfter(start)) return null;

      return { [field]: clamped.toISOString() };
    }
  }
}
