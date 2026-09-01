import { useMemo } from "react";
import { useGanttStore } from "stores/context";
import { isMilestoneTask } from "types/task";
import { resolveFormatters } from "utils/i18n";

interface GanttDragGuidesProps {
  width: number;
}

/**
 * Shows the start/end points during a drag as vertical guides running up through the header
 * Each guide carries the current date label at its top, so the moment can be read straight off the header
 */
export default function GanttDragGuides({ width }: GanttDragGuidesProps) {
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

  const guides = isMilestoneTask(currentTask)
    ? [{ x: startX, label: tooltip(offset.offsetStartDate) }]
    : [
        { x: startX, label: tooltip(offset.offsetStartDate) },
        { x: endX, label: tooltip(offset.offsetEndDate) },
      ];

  return (
    <div
      className="gantt-drag-guides"
      style={{ width: `${width}px` }}
      aria-hidden="true"
    >
      {guides.map((guide, idx) => (
        <div
          key={`guide-${idx}`}
          className="gantt-drag-guide"
          style={{ left: `${guide.x}px` }}
        >
          <span className="gantt-drag-guide-label">{guide.label}</span>
        </div>
      ))}
    </div>
  );
}
