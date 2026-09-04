import { NonWorkingRange } from "timeline/utils/geometry";

interface GanttNonWorkingLayerProps {
  ranges: NonWorkingRange[];
}

// Weekend/holiday shading; decorative, so aria-hidden. A holiday's colour is tinted to the same
// weight as the weekend shade rather than painted, so it reads as the same kind of mark - an
// opaque one would sit on top of the grid instead of under it.
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
          style={{
            left: `${range.left}px`,
            width: `${range.width}px`,
            ...(range.color && {
              background: `color-mix(in srgb, ${range.color} 14%, transparent)`,
            }),
          }}
        />
      ))}
    </div>
  );
}
