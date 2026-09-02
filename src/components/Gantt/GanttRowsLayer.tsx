import { VirtualItem } from "@tanstack/react-virtual";
import { GanttFocus, rowAriaProps } from "utils/a11y";
import { GanttRow, isRowExpandable } from "utils/grouping";

interface GanttRowsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  /**
   * Whether the task list pane holds the treegrid's rows
   *
   * With the pane on screen these stripes are decoration and carry no ARIA; without
   * it they are the rows themselves, so the tree semantics live here instead.
   */
  ownedByTaskList: boolean;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  focus: GanttFocus;
}

/** The row stripes behind the bars */
export default function GanttRowsLayer({
  rows,
  virtualItems,
  ownedByTaskList,
  hierarchy,
  collapsedIds,
  focus,
}: GanttRowsLayerProps) {
  return (
    <div className="gantt-rows" role="presentation">
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        const style = {
          // border-box, so the 1px border is inside the height - matches the row spacing exactly
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        };
        const className = `gantt-task-row${row.group ? " group" : ""}`;

        if (ownedByTaskList) {
          return (
            <div
              key={`row-${row.id}`}
              className={className}
              style={style}
              aria-hidden="true"
            />
          );
        }

        return (
          <div
            key={`row-${row.id}`}
            className={className}
            style={style}
            {...rowAriaProps(row, virtualRow.index, {
              headerOffset: 0,
              expandable: isRowExpandable(row, hierarchy),
              expanded: !collapsedIds.has(row.id),
              ownedIds: row.tasks.map((task) => `task-${task.id}`),
            })}
          >
            {row.group && (
              <div
                className="gantt-group-label"
                role="gridcell"
                tabIndex={
                  focus.row === virtualRow.index && focus.col === 0 ? 0 : -1
                }
                data-gantt-cell={`${virtualRow.index}:0`}
              >
                {row.group.label}
                <span className="gantt-grid-group-count">
                  {row.group.count}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
