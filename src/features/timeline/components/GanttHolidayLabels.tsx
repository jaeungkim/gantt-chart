import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import { MIN_HOLIDAY_LABEL_PX } from "shared/constants";
import { tickAxis, tickCellAt } from "features/timeline/utils/tickAxis";
import { NonWorkingRange } from "features/timeline/utils/geometry";

interface GanttHolidayLabelsProps {
  ranges: NonWorkingRange[];
}

export default function GanttHolidayLabels({
  ranges,
}: GanttHolidayLabelsProps) {
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);
  const axis = useMemo(() => tickAxis(bottomRowCells), [bottomRowCells]);

  const holidays = useMemo(() => {
    const shownCells = new Set<number>();

    return ranges.flatMap((range) => {
      if (!range.label) return [];

      const lastPixelOfBand = range.left + range.width - 1;
      const first = tickCellAt(axis, range.left);
      const last = tickCellAt(axis, lastPixelOfBand);
      if (!first || !last) return [];

      const shown =
        range.width >= MIN_HOLIDAY_LABEL_PX && !shownCells.has(first.index);
      if (shown) shownCells.add(first.index);

      return [
        {
          label: range.label,
          shown,
          left: range.left,
          width: range.width,
          cellLeft: first.left - range.left,
          cellWidth: last.left + last.width - first.left,
        },
      ];
    });
  }, [ranges, axis]);

  if (!holidays.length) return null;

  return (
    <div className="gantt-holiday-labels">
      {holidays.map((holiday) => (
        <div
          key={holiday.left}
          className="gantt-holiday-band"
          style={{ left: `${holiday.left}px`, width: `${holiday.width}px` }}
        >
          <div
            className={`gantt-holiday-cell${holiday.shown ? " shown" : ""}`}
            style={{
              left: `${holiday.cellLeft}px`,
              width: `${holiday.cellWidth}px`,
            }}
          >
            <span>{holiday.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
