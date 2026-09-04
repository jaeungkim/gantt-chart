// The built-in today line, the only vertical marker the chart draws
export function GanttTodayLine({ leftPx }: { leftPx: number | null }) {
  if (leftPx === null) return null;

  return (
    <div
      className="gantt-today-marker"
      style={{ left: `${leftPx}px` }}
      aria-hidden="true"
    />
  );
}

// The head of that line, pinned to the header's bottom edge. Separate component because it lives in
// .gantt-header-wrapper - the line's own parent scrolls under the header, so it cannot reach up there.
export function GanttTodayDot({ leftPx }: { leftPx: number | null }) {
  if (leftPx === null) return null;

  return (
    <div
      className="gantt-today-dot"
      style={{ left: `${leftPx}px` }}
      aria-hidden="true"
    />
  );
}
