import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const { range } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const offset = currentTask ? dragOffsets[currentTask.id] : undefined;
  const label = offset ? range(offset.offsetStartDate, offset.offsetEndDate) : "";

  // The label sits in the band, and lifts into the month row when the band is too narrow to
  // hold it. Measured rather than guessed at a px breakpoint: the text is locale- and
  // override-driven, so any fixed threshold would be wrong in some language. The effect only
  // re-runs when the text itself changes, not on every pointer move.
  const labelRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  useLayoutEffect(() => {
    if (labelRef.current) setLabelWidth(labelRef.current.offsetWidth);
  }, [label]);

  if (!currentTask || !offset) return null;

  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;
  const width = Math.max(endX - startX, 2);

  return (
    <div className="gantt-drag-guides" aria-hidden="true">
      <div
        className="gantt-drag-range"
        style={{ left: `${startX}px`, width: `${width}px` }}
      >
        <span
          ref={labelRef}
          className={`gantt-drag-guide-label${labelWidth > width ? " lifted" : ""}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
