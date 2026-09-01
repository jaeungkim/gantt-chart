import { VirtualItem } from "@tanstack/react-virtual";
import {
  DEFAULT_COLUMN_WIDTH,
  HEADER_HEIGHT,
  NODE_HEIGHT,
  TREE_INDENT,
} from "constants/gantt";
import { useGanttRowDrag } from "hooks/useGanttRowDrag";
import { ReactNode, useRef } from "react";
import { GanttColumn, GanttReorderChange } from "types/gantt";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  Task,
  TaskTransformed,
} from "types/task";
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
  /** Whether rows can be dragged to reorder and re-parent */
  allowRowReorder: boolean;
  /** The same guards the bars use - a row is draggable only where the task can move */
  interaction: GanttInteractionConfig;
  onReorder?: (change: GanttReorderChange) => void | boolean;
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** The selected row, highlighted in step with its bar */
  selectedTaskId?: string | null;
  onRowClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  onRowDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
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
  allowRowReorder,
  interaction,
  onReorder,
  onTasksChange,
  selectedTaskId,
  onRowClick,
  onRowDoubleClick,
}: GanttTaskGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // Row ids are task ids only while every row is one task: a group header is not a task
  // and a lane row carries several, so reordering has nothing single to move
  const reorderable = rows.every((row) => !row.group && row.tasks.length === 1);
  const { onRowPointerDown, dragState } = useGanttRowDrag({
    rows,
    bodyRef,
    enabled: allowRowReorder && reorderable,
    onReorder,
    onTasksChange,
  });
  const dropTarget = dragState?.target ?? null;

  const gridClassName = ["gantt-grid", dragState ? "row-dragging" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={gridClassName}
      style={{ width: `${width}px` }}
      role="presentation"
    >
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
      <div
        ref={bodyRef}
        className="gantt-grid-body"
        style={{ height: `${totalHeight}px` }}
        role="rowgroup"
      >
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

          const isDropParent =
            dropTarget?.mode === "into" &&
            dropTarget.rowIndex === virtualRow.index;
          // A row drag is a move, so it answers to the same guards a bar move does
          const draggable =
            allowRowReorder &&
            reorderable &&
            resolveTaskInteraction(task, interaction).canMove;

          return (
            <div
              key={`grid-row-${row.id}`}
              data-row-id={row.id}
              onPointerDown={draggable ? onRowPointerDown : undefined}
              className={[
                "gantt-grid-row",
                task.isSummary ? "summary" : "",
                draggable ? "draggable" : "",
                dragState?.draggedId === row.id ? "dragging" : "",
                isDropParent ? "drop-into" : "",
                isDropParent && !dropTarget.valid ? "invalid" : "",
                task.id === selectedTaskId ? "selected" : "",
                task.className ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={rowStyle}
              onClick={onRowClick && ((e) => onRowClick(task, e))}
              onDoubleClick={
                onRowDoubleClick && ((e) => onRowDoubleClick(task, e))
              }
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
                        onClick={(e) => {
                          // Expanding a row is not selecting it
                          e.stopPropagation();
                          onToggleCollapse(row.id);
                        }}
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

        {/* Insertion line - sits at the top edge of the target row, indented to the
            level the row would land at */}
        {dropTarget?.mode === "line" && (
          <div
            className={`gantt-grid-drop-line${dropTarget.valid ? "" : " invalid"}`}
            style={{
              top: `${dropTarget.rowIndex * NODE_HEIGHT}px`,
              marginLeft: `${dropTarget.depth * TREE_INDENT}px`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
