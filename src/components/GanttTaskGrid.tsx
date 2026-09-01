import { VirtualItem } from "@tanstack/react-virtual";
import {
  DEFAULT_COLUMN_WIDTH,
  HEADER_HEIGHT,
  MAX_GRID_WIDTH,
  MIN_GRID_WIDTH,
  TREE_INDENT,
} from "constants/gantt";
import { ReactNode } from "react";
import { GanttColumn } from "types/gantt";
import { TaskTransformed } from "types/task";

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
}: GanttTaskGridProps) {
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

  return (
    <div className="gantt-grid" style={{ width: `${width}px` }}>
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
      <div className="gantt-grid-body" style={{ height: `${totalHeight}px` }}>
        {virtualItems.map((virtualRow) => {
          const task = tasks[virtualRow.index];
          if (!task) return null;

          const expandable = hierarchy && task.isSummary;
          const collapsed = collapsedIds.has(task.id);

          return (
            <div
              key={`grid-row-${task.id}`}
              className={`gantt-grid-row${task.isSummary ? " summary" : ""}`}
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
