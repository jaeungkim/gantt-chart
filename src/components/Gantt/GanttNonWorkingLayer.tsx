import { NonWorkingRange } from "utils/timeline";

interface GanttNonWorkingLayerProps {
  ranges: NonWorkingRange[];
}

/** Shading behind weekends and holidays - decoration, so it is hidden from assistive tech */
export default function GanttNonWorkingLayer({
  ranges,
}: GanttNonWorkingLayerProps) {
  if (!ranges.length) return null;

  return (
    <div className="gantt-non-working-layer" aria-hidden="true">
      {ranges.map((range) => (
        <div
          key={range.left}
          className="gantt-non-working-range"
          style={{ left: `${range.left}px`, width: `${range.width}px` }}
        />
      ))}
    </div>
  );
}
