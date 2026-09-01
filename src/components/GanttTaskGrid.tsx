import { VirtualItem } from "@tanstack/react-virtual";
import {
  DEFAULT_COLUMN_WIDTH,
  HEADER_HEIGHT,
  TREE_INDENT,
} from "constants/gantt";
import { ReactNode } from "react";
import { GanttColumn } from "types/gantt";
import { TaskTransformed } from "types/task";
import { GanttFocus, rowAriaProps } from "utils/a11y";
import { GanttRow } from "utils/grouping";

interface GanttTaskGridProps {
  /** The rows on screen (collapsed subtrees and groups are already filtered out) */
  rows: GanttRow[];
  columns: GanttColumn[];
  /** The timeline's own virtualization result - leaves no room for the rows to drift apart */
  virtualItems: VirtualItem[];
  totalHeight: number;
  width: number;
  hierarchy: boolean;
  collapsedIds: Set<string>;
  onToggleCollapse: (rowId: string) => void;
  /** Which cell currently holds the chart's single tab stop */
  focus: GanttFocus;
}

/** Without a render, task[key] is shown as-is */
function renderCell(column: GanttColumn, task: TaskTransformed): ReactNode {
  if (column.render) return column.render(task);

  const value = (task as unknown as Record<string, unknown>)[column.key];
  return value == null ? "" : String(value);
}

/** The first column is the tree column - it takes the leftover width; the rest keep theirs */
function cellStyle(column: GanttColumn, index: number) {
  const width = column.width ?? DEFAULT_COLUMN_WIDTH;
  return index === 0
    ? { flex: `1 1 ${width}px`, minWidth: 60 }
    : { flex: `0 0 ${width}px` };
}

/**
 * The task grid on the left
 *
 * A sticky column inside the timeline's own scroll container, so vertical scrolling is
 * locked to the rows by construction.
 * (Syncing two panes through scroll events drifts the moment virtualization kicks in)
 *
 * These rows are the treegrid's `row` elements: each one owns its bars in the
 * timeline through `aria-owns`, which is what makes the two panes read as a
 * single widget rather than two unrelated lists.
 */
export default function GanttTaskGrid({
  rows,
  columns,
  virtualItems,
  totalHeight,
  width,
  hierarchy,
  collapsedIds,
  onToggleCollapse,
  focus,
}: GanttTaskGridProps) {
  return (
    <div className="gantt-grid" style={{ width: `${width}px` }} role="presentation">
      {/* Header - has to be exactly as tall as the timeline header or the rows shift */}
      <div
        className="gantt-grid-header"
        style={{ height: `${HEADER_HEIGHT}px` }}
        role="row"
        aria-rowindex={1}
      >
        {columns.map((column, index) => (
          <div
            key={column.key}
            className="gantt-grid-header-cell"
            style={cellStyle(column, index)}
            role="columnheader"
          >
            {column.header}
          </div>
        ))}
        {/* The timeline's date header is decorative, so the bar column is named here */}
        <span className="gantt-sr-only" role="columnheader">
          Timeline
        </span>
      </div>

      {/* Rows - straight from the timeline's own virtualItems */}
      <div className="gantt-grid-body" style={{ height: `${totalHeight}px` }} role="rowgroup">
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          const task = row.tasks[0];
          const expandable = !!row.group || (hierarchy && !!task?.isSummary);
          const collapsed = collapsedIds.has(row.id);
          const focused = focus.row === virtualRow.index;
          const aria = rowAriaProps(row, virtualRow.index, {
            headerOffset: 1,
            expandable,
            expanded: !collapsed,
            ownedIds: row.tasks.map((member) => `task-${member.id}`),
          });

          const rowStyle = {
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          };

          if (row.group) {
            return (
              <div
                key={`grid-row-${row.id}`}
                className="gantt-grid-row group"
                style={rowStyle}
                {...aria}
              >
                <div
                  className="gantt-grid-cell"
                  style={{ flex: "1 1 100%", minWidth: 0 }}
                  role="gridcell"
                  tabIndex={focused && focus.col === 0 ? 0 : -1}
                  data-gantt-cell={`${virtualRow.index}:0`}
                >
                  <button
                    type="button"
                    className={`gantt-grid-expander${collapsed ? "" : " open"}`}
                    onClick={() => onToggleCollapse(row.id)}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M4 2.5 L8 6 L4 9.5" />
                    </svg>
                  </button>
                  <span className="gantt-grid-cell-text">
                    {row.group.label}
                  </span>
                  <span className="gantt-grid-group-count">
                    {row.group.count}
                  </span>
                </div>
              </div>
            );
          }

          if (!task) return null;

          return (
            <div
              key={`grid-row-${row.id}`}
              className={`gantt-grid-row${task.isSummary ? " summary" : ""}`}
              style={rowStyle}
              {...aria}
            >
              {columns.map((column, index) => (
                <div
                  key={column.key}
                  className="gantt-grid-cell"
                  style={cellStyle(column, index)}
                  title={index === 0 ? task.name : undefined}
                  role="gridcell"
                  tabIndex={focused && focus.col === index ? 0 : -1}
                  data-gantt-cell={`${virtualRow.index}:${index}`}
                >
                  {index === 0 && (
                    <span
                      className="gantt-grid-indent"
                      style={{ width: `${row.depth * TREE_INDENT}px` }}
                    />
                  )}
                  {index === 0 &&
                    (expandable ? (
                      <button
                        type="button"
                        className={`gantt-grid-expander${
                          collapsed ? "" : " open"
                        }`}
                        onClick={() => onToggleCollapse(row.id)}
                        // The row carries aria-expanded, so the toggle is not a
                        // second tab stop and not a second thing to announce
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M4 2.5 L8 6 L4 9.5" />
                        </svg>
                      </button>
                    ) : (
                      // Holds the space so rows without a toggle start their text in the same place
                      <span className="gantt-grid-expander-spacer" />
                    ))}
                  <span className="gantt-grid-cell-text">
                    {renderCell(column, task)}
                  </span>
                  {index === 0 && row.tasks.length > 1 && (
                    <span className="gantt-grid-group-count">
                      +{row.tasks.length - 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
