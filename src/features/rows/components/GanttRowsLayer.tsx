import type { VirtualItem } from "shared/virtual/window";
import { GanttRow } from "features/rows/utils/rows";

interface GanttRowsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
}

export default function GanttRowsLayer({
  rows,
  virtualItems,
}: GanttRowsLayerProps) {
  return (
    <div className="gantt-rows">
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        const style = {
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        };

        return (
          <div key={`row-${row.id}`} className="gantt-task-row" style={style} />
        );
      })}
    </div>
  );
}
