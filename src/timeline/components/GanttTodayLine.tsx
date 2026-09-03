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
