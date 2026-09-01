import { VirtualItem } from "@tanstack/react-virtual";
import {
  DEFAULT_COLUMN_WIDTH,
  HEADER_HEIGHT,
  MAX_GRID_WIDTH,
  MIN_GRID_WIDTH,
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

interface GanttTaskGridProps {
  /** The rows on screen (collapsed subtrees are already filtered out) */
  tasks: TaskTransformed[];
  columns: GanttColumn[];
  /** The timeline's own virtualization result - leaves no room for the rows to drift apart */
  virtualItems: VirtualItem[];
  totalHeight: number;
  width: number;
  onWidthChange: (width: number) => void;
  hierarchy: boolean;
  collapsedIds: Set<string>;
  onToggleCollapse: (taskId: string) => void;
  /** Whether rows can be dragged to reorder and re-parent */
  allowRowReorder: boolean;
  /** The same guards the bars use - a row is draggable only where the task can move */
  interaction: GanttInteractionConfig;
  onReorder?: (change: GanttReorderChange) => void | boolean;
  onTasksChange?: (updatedTasks: Task[]) => void;
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
 */
export default function GanttTaskGrid({
  tasks,
  columns,
  virtualItems,
  totalHeight,
  width,
  onWidthChange,
  hierarchy,
  collapsedIds,
  onToggleCollapse,
  allowRowReorder,
  interaction,
  onReorder,
  onTasksChange,
}: GanttTaskGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { onRowPointerDown, dragState } = useGanttRowDrag({
    rows: tasks,
    bodyRef,
    enabled: allowRowReorder,
    onReorder,
    onTasksChange,
  });
  const dropTarget = dragState?.target ?? null;

  const clampWidth = (next: number) =>
    Math.min(MAX_GRID_WIDTH, Math.max(MIN_GRID_WIDTH, next));

  const onSplitterPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e
  ) => {
    if (!e.isPrimary || e.button !== 0) return;

    const startX = e.clientX;
    const startWidth = width;
    e.currentTarget.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return;
      onWidthChange(clampWidth(startWidth + moveEvent.clientX - startX));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== e.pointerId) return;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  const onSplitterKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onWidthChange(clampWidth(width + (e.key === "ArrowLeft" ? -16 : 16)));
  };

  const gridClassName = ["gantt-grid", dragState ? "row-dragging" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={gridClassName} style={{ width: `${width}px` }}>
      {/* Header - has to be exactly as tall as the timeline header or the rows shift */}
      <div className="gantt-grid-header" style={{ height: `${HEADER_HEIGHT}px` }}>
        {columns.map((column, index) => (
          <div
            key={column.key}
            className="gantt-grid-header-cell"
            style={cellStyle(column, index)}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Rows - straight from the timeline's own virtualItems */}
      <div
        ref={bodyRef}
        className="gantt-grid-body"
        style={{ height: `${totalHeight}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const task = tasks[virtualRow.index];
          if (!task) return null;

          const expandable = hierarchy && task.isSummary;
          const collapsed = collapsedIds.has(task.id);
          const isDropParent =
            dropTarget?.mode === "into" && dropTarget.rowIndex === virtualRow.index;
          // A row drag is a move, so it answers to the same guards a bar move does
          const draggable =
            allowRowReorder && resolveTaskInteraction(task, interaction).canMove;

          return (
            <div
              key={`grid-row-${task.id}`}
              data-row-id={task.id}
              onPointerDown={draggable ? onRowPointerDown : undefined}
              className={[
                "gantt-grid-row",
                task.isSummary ? "summary" : "",
                draggable ? "draggable" : "",
                dragState?.draggedId === task.id ? "dragging" : "",
                isDropParent ? "drop-into" : "",
                isDropParent && !dropTarget.valid ? "invalid" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {columns.map((column, index) => (
                <div
                  key={column.key}
                  className="gantt-grid-cell"
                  style={cellStyle(column, index)}
                  title={index === 0 ? task.name : undefined}
                >
                  {index === 0 && (
                    <span
                      className="gantt-grid-indent"
                      style={{ width: `${task.depth * TREE_INDENT}px` }}
                    />
                  )}
                  {index === 0 &&
                    (expandable ? (
                      <button
                        type="button"
                        className={`gantt-grid-expander${
                          collapsed ? "" : " open"
                        }`}
                        onClick={() => onToggleCollapse(task.id)}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? "Expand" : "Collapse"} ${task.name}`}
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

      {/* Resize splitter */}
      <div
        className="gantt-grid-splitter"
        onPointerDown={onSplitterPointerDown}
        onKeyDown={onSplitterKeyDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize task list"
        aria-valuenow={width}
        aria-valuemin={MIN_GRID_WIDTH}
        aria-valuemax={MAX_GRID_WIDTH}
        tabIndex={0}
      />
    </div>
  );
}
