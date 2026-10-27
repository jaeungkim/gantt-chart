export function GanttTodayLine({ leftPx }: { leftPx: number | null }) {
  if (leftPx === null) return null;

  return (
    <div
      className="gantt-today-marker"
      style={{ left: `${leftPx}px` }}
    />
  );
}

export function GanttTodayDot({ leftPx }: { leftPx: number | null }) {
  if (leftPx === null) return null;

  return (
    <div
      className="gantt-today-dot"
      style={{ left: `${leftPx}px` }}
    />
  );
}
