interface GanttTaskAddRowProps {
  width: number;
  /** Proposes the new task - the same thing `addTask()` on the chart ref calls */
  onAdd: () => void;
}

// Rendered outside the scroll container, next to the splitter: the pane sits inside the
// treegrid, whose children may only be rows, and the grid holds exactly one tab stop.
export default function GanttTaskAddRow({
  width,
  onAdd,
}: GanttTaskAddRowProps) {
  return (
    <div className="gantt-grid-footer" style={{ width: `${width}px` }}>
      <button type="button" className="gantt-grid-add" onClick={onAdd}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2.5 V9.5 M2.5 6 H9.5" />
        </svg>
        Add task
      </button>
    </div>
  );
}
