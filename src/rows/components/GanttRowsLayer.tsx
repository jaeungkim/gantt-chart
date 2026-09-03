import type { VirtualItem } from "shared/virtual/window";
import { rowAriaProps } from "interaction/utils/a11y";
import { GanttRow, isRowExpandable } from "rows/utils/rows";

interface GanttRowsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  /** With the task list pane on screen the stripes carry no ARIA; without it they are the rows */
  ownedByTaskList: boolean;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
}

/** The row stripes behind the bars */
export default function GanttRowsLayer({
  rows,
  virtualItems,
  ownedByTaskList,
  hierarchy,
  collapsedIds,
}: GanttRowsLayerProps) {
  return (
    <div className="gantt-rows" role="presentation">
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        const style = {
          // border-box, so the 1px border sits inside the height
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        };

        if (ownedByTaskList) {
          return (
            <div
              key={`row-${row.id}`}
              className="gantt-task-row"
              style={style}
              aria-hidden="true"
            />
          );
        }

        return (
          <div
            key={`row-${row.id}`}
            className="gantt-task-row"
            style={style}
            {...rowAriaProps(row, virtualRow.index, {
              headerOffset: 0,
              expandable: isRowExpandable(row, hierarchy),
              expanded: !collapsedIds.has(row.id),
              ownedIds: row.tasks.map((task) => `task-${task.id}`),
            })}
          />
        );
      })}
    </div>
  );
}
