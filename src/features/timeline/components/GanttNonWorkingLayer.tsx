import { NonWorkingRange } from "features/timeline/utils/geometry";

interface GanttNonWorkingLayerProps {
  ranges: NonWorkingRange[];
}

// Weekend/holiday shading. A holiday's colour is mixed down to a tint rather than painted, so it
// reads as the same kind of mark as the weekend shade.
export default function GanttNonWorkingLayer({
  ranges,
}: GanttNonWorkingLayerProps) {
  if (!ranges.length) return null;

  return (
    <div className="gantt-non-working-layer">
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
