import { CSSProperties } from "react";
import { PositionedBand, PositionedMarker } from "utils/timeline";

/** Custom color goes through a variable so the line and its label stay in step */
const colorVar = (color: string | undefined, name: string): CSSProperties =>
  color ? ({ [name]: color } as CSSProperties) : {};

/**
 * Shaded date-range bands (sprints, phases)
 *
 * Drawn on the background layer, below the rows, arrows and bars.
 */
export function GanttRangeBands({ bands }: { bands: PositionedBand[] }) {
  if (!bands.length) return null;

  return (
    <div className="gantt-range-band-layer" aria-hidden="true">
      {bands.map(({ band, leftPx, widthPx }, index) => (
        <div
          key={band.id ?? `${String(band.startDate)}-${index}`}
          className={`gantt-range-band${band.className ? ` ${band.className}` : ""}`}
          style={{
            left: `${leftPx}px`,
            width: `${widthPx}px`,
            ...colorVar(band.color, "--gantt-band-color"),
          }}
        >
          {band.label && <span className="gantt-range-band-label">{band.label}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Vertical date markers (deadlines, releases, and the chart's own today line)
 *
 * `data-warning` is set when a task the marker watches ends past its date, so the warning
 * look is a plain CSS attribute selector the host can restyle.
 */
export function GanttMarkers({ markers }: { markers: PositionedMarker[] }) {
  if (!markers.length) return null;

  return (
    <>
      {markers.map(({ marker, leftPx, overrun }, index) => (
        <div
          key={marker.id ?? `${String(marker.date)}-${index}`}
          className={`gantt-marker${marker.className ? ` ${marker.className}` : ""}`}
          style={{
            left: `${leftPx}px`,
            ...colorVar(marker.color, "--gantt-marker-color"),
          }}
          data-warning={overrun ? "true" : undefined}
          aria-hidden="true"
        >
          {marker.label && <span className="gantt-marker-label">{marker.label}</span>}
        </div>
      ))}
    </>
  );
}
