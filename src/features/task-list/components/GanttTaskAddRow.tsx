interface GanttTaskAddRowProps {
  width: number;
  onAdd: () => void;
}

export default function GanttTaskAddRow({
  width,
  onAdd,
}: GanttTaskAddRowProps) {
  return (
    <div className="gantt-grid-footer" style={{ width: `${width}px` }}>
      <button type="button" className="gantt-grid-add" onClick={onAdd}>
        <svg viewBox="0 0 12 12">
          <path d="M6 2.5 V9.5 M2.5 6 H9.5" />
        </svg>
        Add task
      </button>
    </div>
  );
}
