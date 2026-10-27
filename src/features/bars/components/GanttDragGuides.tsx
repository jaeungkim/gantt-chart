import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import type { GanttLocaleOptions } from "shared/types";
import { resolveFormatters } from "shared/utils/i18n";
import { tickAxis, tickCellAt } from "features/timeline/utils/tickAxis";

export default function GanttDragGuides({
  localeOptions,
}: {
  localeOptions?: GanttLocaleOptions;
}) {
  const barDrag = useGanttStore((store) => store.barDrag);
  const dragOffsets = useGanttStore((store) => store.dragOffsets);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);
  const transformedTasks = useGanttStore((store) => store.transformedTasks);
  const { edge, range } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const axis = useMemo(() => tickAxis(bottomRowCells), [bottomRowCells]);

  const offset = barDrag ? dragOffsets[barDrag.task.id] : undefined;
  if (!barDrag || !offset?.offsetStartDate || !offset.offsetEndDate) return null;
  const { task: pressedTask, mode: dragMode } = barDrag;
  const currentTask =
    transformedTasks.find((task) => task.id === pressedTask.id) ?? pressedTask;

  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;

  const startCell = tickCellAt(axis, startX);
  const endCell = tickCellAt(axis, endX);
  if (!startCell || !endCell) return null;

  const cells = (() => {
    if (dragMode === "left")
      return [{ cell: startCell, label: edge(offset.offsetStartDate) }];
    if (dragMode === "right")
      return [{ cell: endCell, label: edge(offset.offsetEndDate) }];
    if (startCell.index === endCell.index)
      return [
        {
          cell: startCell,
          label: range(offset.offsetStartDate, offset.offsetEndDate),
        },
      ];
    return [
      { cell: startCell, label: edge(offset.offsetStartDate) },
      { cell: endCell, label: edge(offset.offsetEndDate) },
    ];
  })();

  return (
    <div className="gantt-drag-guides">
      {cells.map(({ cell, label }) => (
        <div
          key={cell.index}
          className="gantt-drag-cell"
          style={{ left: `${cell.left}px`, width: `${cell.width}px` }}
        >
          <span>{label}</span>
        </div>
      ))}
      <div
        className="gantt-drag-footprint"
        style={{
          left: `${startX}px`,
          width: `${Math.max(endX - startX, 2)}px`,
        }}
      />
    </div>
  );
}
