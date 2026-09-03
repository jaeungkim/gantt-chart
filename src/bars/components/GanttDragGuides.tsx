import { useMemo } from "react";
import { useGanttStore } from "shared/context";
import { resolveFormatters } from "shared/utils/i18n";
import { snapDown, snapUp, tickBoundaries } from "timeline/utils/header";

// The live readout for a move or resize. It is the tick row being precise for the length of one
// gesture: the exact date is typeset at the edge the gesture is moving, in the row's own 11px
// type, and the ruler outside the dragged span keeps counting. Nothing is drawn around it - the
// numerals the span covers step aside behind a mask in the row's own colour.
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

  const boundaries = useMemo(
    () => tickBoundaries(bottomRowCells),
    [bottomRowCells]
  );

  const offset = currentTask ? dragOffsets[currentTask.id] : undefined;
  if (!currentTask || !offset) return null;

  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;
  const width = Math.max(endX - startX, 2);

  // The mask is snapped out to whole cells, because a tick numeral is centred in its cell: an edge
  // landing mid-numeral would leave half a glyph standing beside the date that replaced it.
  const maskLeft = snapDown(boundaries, startX);
  const maskRight = snapUp(boundaries, endX);

  const startLabel = edge(offset.offsetStartDate);
  const endLabel = edge(offset.offsetEndDate);

  // Ends that read alike are a span the scale cannot tell apart, so one label stands for both -
  // and `range` is what knows how to merge them, dropping what they share under a locale.
  const merged =
    startLabel === endLabel
      ? range(offset.offsetStartDate, offset.offsetEndDate)
      : null;

  const sides =
    merged !== null
      ? [{ side: "start end", label: merged }]
      : dragMode === "left"
        ? [{ side: "start", label: startLabel }]
        : dragMode === "right"
          ? [{ side: "end", label: endLabel }]
          : [
              { side: "start", label: startLabel },
              { side: "end", label: endLabel },
            ];

  return (
    <div className="gantt-drag-guides" aria-hidden="true">
      <div
        className="gantt-drag-mask"
        style={{ left: `${maskLeft}px`, width: `${maskRight - maskLeft}px` }}
      />
      <div
        className="gantt-drag-range"
        style={{ left: `${startX}px`, width: `${width}px` }}
      >
        {/* Each label gets its own half of the span. The half is what bounds its sticky travel,
            so two pinned labels can never slide into one another when most of the span is off
            screen - the far one simply leaves with the edge it reports. */}
        {sides.map(({ side, label }) => (
          <span key={side} className={`gantt-drag-side ${side}`}>
            <span className={`gantt-drag-edge ${side}`}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
