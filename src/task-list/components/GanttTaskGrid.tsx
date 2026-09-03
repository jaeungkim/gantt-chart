import type { VirtualItem } from "shared/virtual/window";
import { HEADER_HEIGHT, TREE_INDENT } from "shared/constants";
import { useGanttRowDrag } from "task-list/hooks/useGanttRowDrag";
import { GanttTaskMoveApi } from "task-list/hooks/useGanttTaskMove";
import { useRef } from "react";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  TaskTransformed,
} from "shared/task";
import { GanttFocus, rowAriaProps } from "interaction/utils/a11y";
import { GanttRow, isRowExpandable } from "rows/utils/grouping";

interface GanttTaskGridProps {
  // Rows on screen - collapsed subtrees are already filtered out
  rows: GanttRow[];
  // The timeline's own virtualization result, so the two panes cannot drift apart
  virtualItems: VirtualItem[];
  totalHeight: number;
  width: number;
  // Prints each row's `sequence` ("2.1") as a leading column; bands have none, so they stay blank
  showRowNumbers: boolean;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapse: (rowId: string) => void;
  // Which cell currently holds the chart's single tab stop
  focus: GanttFocus;
  reorderEnabled: boolean;
  // The same guards the bars use - a row is draggable only where the task can move
  interaction: GanttInteractionConfig;
  move: GanttTaskMoveApi;
  selectedTaskId?: string | null;
  onRowClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  onRowDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
}

// A sticky column inside the timeline's own scroll container, so vertical scrolling cannot
// drift. The rows are the treegrid's `row` elements and own their bars via `aria-owns`.
export default function GanttTaskGrid({
  rows,
  virtualItems,
  totalHeight,
  width,
  showRowNumbers,
  hierarchy,
  collapsedIds,
  onToggleCollapse,
  focus,
  reorderEnabled,
  interaction,
  move,
  selectedTaskId,
  onRowClick,
  onRowDoubleClick,
}: GanttTaskGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { onGripPointerDown, draft } = useGanttRowDrag({
    rows,
    virtualItems,
    bodyRef,
    hierarchy,
    move,
  });
  // The row the indicator attaches to - culled from the window, nothing to draw
  const dropRow = draft
    ? virtualItems.find((item) => item.index === draft.rowIndex)
    : undefined;

  return (
    <div
      className="gantt-grid"
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
        {/* No visible caption: a printed "Name" would be a hardcoded English string */}
        <div className="gantt-grid-header-cell" role="columnheader">
          <span className="gantt-sr-only">Task name</span>
        </div>
        {/* The timeline's date header is decorative, so the bar column is named here */}
        <span className="gantt-sr-only" role="columnheader">
          Timeline
        </span>
      </div>

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
          const expandable = isRowExpandable(row, hierarchy);
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
                  role="gridcell"
                  tabIndex={focused && focus.col === 0 ? 0 : -1}
                  data-gantt-cell={`${virtualRow.index}:0`}
                >
                  {/* A band cannot be dragged, but its text still starts where a task's does */}
                  {reorderEnabled && <span className="gantt-grid-grip-spacer" />}
                  {showRowNumbers && <span className="gantt-grid-no" />}
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

          // A row that carries a whole lane names no single task to move
          const canReorder =
            reorderEnabled &&
            row.tasks.length === 1 &&
            resolveTaskInteraction(task, interaction).canReorder;

          return (
            <div
              key={`grid-row-${row.id}`}
              data-row-id={row.id}
              className={[
                "gantt-grid-row",
                task.isSummary ? "summary" : "",
                task.id === selectedTaskId ? "selected" : "",
                task.id === draft?.taskId ? "dragging" : "",
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
              <div
                className="gantt-grid-cell"
                title={task.name}
                role="gridcell"
                tabIndex={focused && focus.col === 0 ? 0 : -1}
                data-gantt-cell={`${virtualRow.index}:0`}
              >
                  {/* First in the cell, so the grip sits at x=0 whatever the depth */}
                  {reorderEnabled &&
                    (canReorder ? (
                      <button
                        type="button"
                        className="gantt-grid-grip"
                        onPointerDown={(e) => {
                          // Grabbing the grip is not selecting the row
                          e.stopPropagation();
                          onGripPointerDown(virtualRow.index, e);
                        }}
                        // The row is the tab stop and the drag has a keyboard equivalent
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <circle cx="4.5" cy="2.5" r="1.1" />
                          <circle cx="7.5" cy="2.5" r="1.1" />
                          <circle cx="4.5" cy="6" r="1.1" />
                          <circle cx="7.5" cy="6" r="1.1" />
                          <circle cx="4.5" cy="9.5" r="1.1" />
                          <circle cx="7.5" cy="9.5" r="1.1" />
                        </svg>
                      </button>
                    ) : (
                      // Holds the space so the row's text does not jog
                      <span className="gantt-grid-grip-spacer" />
                    ))}
                  {showRowNumbers && (
                    <span className="gantt-grid-no">{task.sequence}</span>
                  )}
                  <span
                    className="gantt-grid-indent"
                    style={{ width: `${row.depth * TREE_INDENT}px` }}
                  />
                  {expandable ? (
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
                        // The row carries aria-expanded, so the toggle is not a second stop
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M4 2.5 L8 6 L4 9.5" />
                        </svg>
                      </button>
                  ) : (
                    // Holds the space so untoggled rows start their text in the same place
                    <span className="gantt-grid-expander-spacer" />
                  )}
                  <span className="gantt-grid-cell-text">{task.name}</span>
                  {row.tasks.length > 1 && (
                    <span className="gantt-grid-group-count">
                      +{row.tasks.length - 1}
                    </span>
                  )}
              </div>
            </div>
          );
        })}

        {/* Where the row would land - a line between rows, or a ring around a new parent */}
        {draft && dropRow && (
          <div
            className={[
              "gantt-grid-drop",
              draft.mode === "child" ? "child" : "",
              draft.rejection ? "blocked" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              draft.mode === "child"
                ? { top: `${dropRow.start}px`, height: `${dropRow.size}px` }
                : {
                    top: `${
                      dropRow.start +
                      (draft.mode === "after" ? dropRow.size : 0)
                    }px`,
                    marginLeft: `${draft.depth * TREE_INDENT}px`,
                  }
            }
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
