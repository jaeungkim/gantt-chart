import type { VirtualItem } from "shared/virtual/window";
import { GanttRow } from "features/rows/utils/rows";

interface GanttRowsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
}

/** The row stripes behind the bars */
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
          // border-box, so the 1px border sits inside the height
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
