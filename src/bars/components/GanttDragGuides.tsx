import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import { resolveFormatters } from "shared/utils/i18n";
import { tickAxis, tickCellAt } from "timeline/utils/header";

// The live readout for a move or resize. It is the tick row being precise for the length of one
// gesture: the cell each moving edge lands in writes the full date instead of its numeral, in the
// row's own type, centred where the numeral stood - on the grid, so nothing floats. Under it the
// bar's footprint - its exact span, its own radius - is tinted onto the ruler, tying the two
// together without drawing a shape of its own around anything.
// A move carries both edges, so it writes both. A resize writes only the edge under the pointer:
// the other end is not changing, and a second label that never moves is one number to ignore.
// Mounted inside `.gantt-header-wrapper`, which is sticky and `totalWidth` wide - hence no width
// prop, no z-index, and `left` already in the same space as a bar's `barLeft`.
// aria-hidden: the bar's own tooltip stays the live region for a pointer drag.
export default function GanttDragGuides() {
  const currentTask = useGanttStore((store) => store.currentTask);
  const dragOffsets = useGanttStore((store) => store.dragOffsets);
  const dragMode = useGanttStore((store) => store.dragMode);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);
  const { edge, range } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const axis = useMemo(() => tickAxis(bottomRowCells), [bottomRowCells]);

  const offset = currentTask ? dragOffsets[currentTask.id] : undefined;
  if (!currentTask || !offset) return null;

  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;

  const startCell = tickCellAt(axis, startX);
  const endCell = tickCellAt(axis, endX);
  if (!startCell || !endCell) return null;

  // Two edges in one cell are one label, and `range` is what knows how to write it - merging
  // what the ends share under a locale, or collapsing them when they read alike.
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
    <div className="gantt-drag-guides" aria-hidden="true">
      {cells.map(({ cell, label }) => (
        <div
          key={cell.index}
          className="gantt-drag-cell"
          style={{ left: `${cell.left}px`, width: `${cell.width}px` }}
        >
          <span>{label}</span>
        </div>
      ))}
      {/* Last, so the tint runs to the bar's pixel edge through the cell that writes the date */}
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
