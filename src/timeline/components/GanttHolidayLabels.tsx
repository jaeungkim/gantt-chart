import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import { MIN_HOLIDAY_LABEL_PX } from "shared/constants";
import { tickBoundaries, tickCellAt } from "timeline/utils/header";
import { NonWorkingRange } from "timeline/utils/geometry";

interface GanttHolidayLabelsProps {
  ranges: NonWorkingRange[];
}

// A named holiday writes its name in the tick row, the way a dragged edge writes its date: the
// cells it falls in give up their numerals and the name stands centred where they were, on the
// grid, nothing floating. One name per holiday however many days it runs.
//
// It covers whole tick cells, not the holiday's own band - a band is a third of a cell at the
// month scale, and blanking a third of a cell leaves a numeral sliced down the middle.
//
// A band wide enough to have earned the room keeps its name up; a narrower one hands it back to
// the ruler and writes it only while the pointer is over the holiday, which is the same gesture
// bargain a drag makes. That is CSS on the band's own hover, so no state and no re-render.
// The hover target is the header and only the header: the shading in the body sits under the
// pointer surface that draws new tasks, and a target there would eat those gestures.
//
// Not aria-hidden, and hidden by opacity rather than display, so the name is announced either way.
export default function GanttHolidayLabels({
  ranges,
}: GanttHolidayLabelsProps) {
  const bottomRowCells = useGanttStore((store) => store.bottomRowCells);
  const boundaries = useMemo(
    () => tickBoundaries(bottomRowCells),
    [bottomRowCells]
  );

  const holidays = useMemo(() => {
    const shownCells = new Set<number>();

    return ranges.flatMap((range) => {
      if (!range.label) return [];

      const first = tickCellAt(boundaries, range.left);
      // The band's last pixel, so one ending exactly on a boundary does not claim the next cell
      const last = tickCellAt(boundaries, range.left + range.width - 1);
      if (!first || !last) return [];

      // Two names standing in one cell would print on top of each other; the earlier one keeps it.
      // Hovered names are exclusive by definition, so only the standing ones are worth counting.
      const shown =
        range.width >= MIN_HOLIDAY_LABEL_PX && !shownCells.has(first.index);
      if (shown) shownCells.add(first.index);

      return [
        {
          label: range.label,
          shown,
          left: range.left,
          width: range.width,
          // Relative to the band, which is what the hover target is positioned at
          cellLeft: first.left - range.left,
          cellWidth: last.left + last.width - first.left,
        },
      ];
    });
  }, [ranges, boundaries]);

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
