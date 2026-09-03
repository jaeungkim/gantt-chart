import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import { resolveFormatters } from "shared/utils/i18n";

// The live readout for a move or resize, drawn on the date axis. Mounted inside
// `.gantt-header-wrapper`, which is sticky and `totalWidth` wide - hence no width prop,
// no z-index, and `left` already in the same space as a bar's `barLeft`.
// aria-hidden: the bar's own tooltip stays the live region for a pointer drag.
export default function GanttDragGuides() {
  const currentTask = useGanttStore((store) => store.currentTask);
  const dragOffsets = useGanttStore((store) => store.dragOffsets);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const { tooltip } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const offset = currentTask ? dragOffsets[currentTask.id] : undefined;
  if (!currentTask || !offset) return null;

  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;

  return (
    <div className="gantt-drag-guides" aria-hidden="true">
      <div
        className="gantt-drag-range"
        style={{ left: `${startX}px`, width: `${Math.max(endX - startX, 2)}px` }}
      >
        <span className="gantt-drag-guide-label">
          {`${tooltip(offset.offsetStartDate)} → ${tooltip(offset.offsetEndDate)}`}
        </span>
      </div>
    </div>
  );
}
