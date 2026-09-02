import { useMemo } from "react";
import { GanttInteractionConfig } from "types/task";

/**
 * Pins the chart-wide interaction flags to one object identity
 *
 * Every bar, arrow and grid row is handed this object, so a render that changed
 * none of the flags must hand them the same one. The caller passes a plain literal
 * and the memo keys on the values inside it, not on that literal's identity.
 * (A task's own flags still win over these - see `resolveTaskInteraction`)
 */
export function useGanttInteraction({
  readOnly,
  allowMove,
  allowResize,
  allowProgressChange,
  allowLinkCreate,
  allowLinkDelete,
  allowTaskCreate,
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
      minDate,
      maxDate,
    ]
  );
}
