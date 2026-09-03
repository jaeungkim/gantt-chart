import { useMemo } from "react";
import { GanttInteractionConfig } from "shared/task";

// One stable identity for the chart-wide flags, keyed on the values rather than the
// caller's literal. A task's own flags still win - see `resolveTaskInteraction`.
export function useGanttInteraction({
  readOnly,
  allowMove,
  allowResize,
  allowProgressChange,
  allowLinkCreate,
  allowLinkDelete,
  allowTaskCreate,
  allowReorder,
  minDate,
  maxDate,
}: GanttInteractionConfig): GanttInteractionConfig {
  return useMemo(
    () => ({
      readOnly,
      allowMove,
      allowResize,
      allowProgressChange,
      allowLinkCreate,
      allowLinkDelete,
      allowTaskCreate,
      allowReorder,
      minDate,
      maxDate,
    }),
    [
      readOnly,
      allowMove,
      allowResize,
      allowProgressChange,
      allowLinkCreate,
      allowLinkDelete,
      allowTaskCreate,
      allowReorder,
      minDate,
      maxDate,
    ]
  );
}
