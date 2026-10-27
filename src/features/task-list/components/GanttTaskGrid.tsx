import type { VirtualItem } from "shared/virtual/window";
import { HEADER_HEIGHT, TREE_INDENT } from "shared/constants";
import { useGanttRowDrag } from "features/task-list/hooks/useGanttRowDrag";
import { GanttTaskMoveApi } from "features/task-list/types";
import { useRef } from "react";
import { useGanttStore } from "shared/context";
import {
  GanttInteractionConfig,
  resolveTaskInteraction,
  TaskTransformed,
} from "shared/task";
import { GanttRow } from "features/rows/utils/rows";

interface GanttTaskGridProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  totalHeight: number;
  width: number;
  showRowNumbers: boolean;
  hierarchy: boolean;
  collapsedIds: ReadonlySet<string>;
  onToggleCollapse: (rowId: string) => void;
  reorderEnabled: boolean;
  interaction: GanttInteractionConfig;
  move: GanttTaskMoveApi;
  onRowClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  onRowDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
}

export default function GanttTaskGrid({
  rows,
  virtualItems,
  totalHeight,
  width,
  showRowNumbers,
  hierarchy,
  collapsedIds,
  onToggleCollapse,
  reorderEnabled,
  interaction,
  move,
  onRowClick,
  onRowDoubleClick,
}: GanttTaskGridProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const selectedTaskId = useGanttStore((store) => store.selectedTaskId);
  const { onGripPointerDown, consumeDragClick, draft } = useGanttRowDrag({
    rows,
    virtualItems,
    bodyRef,
    hierarchy,
    move,
  });
  const dropRow = draft
    ? virtualItems.find((item) => item.index === draft.rowIndex)
    : undefined;

  return (
    <div className="gantt-grid" style={{ width: `${width}px` }}>
      <div
        className="gantt-grid-header"
        style={{ height: `${HEADER_HEIGHT}px` }}
      />

      <div
        ref={bodyRef}
        className="gantt-grid-body"
        style={{ height: `${totalHeight}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          const task = row.tasks[0];
          const expandable = hierarchy && !!task.isSummary;
          const collapsed = collapsedIds.has(row.id);

          const rowStyle = {
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          };

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
              onClick={
                onRowClick &&
                ((e) => {
                  if (!consumeDragClick()) onRowClick(task, e);
                })
              }
              onDoubleClick={
                onRowDoubleClick && ((e) => onRowDoubleClick(task, e))
              }
            >
              <div className="gantt-grid-cell" title={task.name}>
                  {reorderEnabled &&
                    (canReorder ? (
                      <button
                        type="button"
                        className="gantt-grid-grip"
                        aria-label="Drag to reorder"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onGripPointerDown(virtualRow.index, e);
                        }}
                      >
                        <svg viewBox="0 0 12 12">
                          <circle cx="4.5" cy="2.5" r="1.1" />
                          <circle cx="7.5" cy="2.5" r="1.1" />
                          <circle cx="4.5" cy="6" r="1.1" />
                          <circle cx="7.5" cy="6" r="1.1" />
                          <circle cx="4.5" cy="9.5" r="1.1" />
                          <circle cx="7.5" cy="9.5" r="1.1" />
                        </svg>
                      </button>
                    ) : (
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
                        aria-label={collapsed ? "Expand" : "Collapse"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCollapse(row.id);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 12 12">
                          <path d="M4 2.5 L8 6 L4 9.5" />
                        </svg>
                      </button>
                  ) : (
                    <span className="gantt-grid-expander-spacer" />
                  )}
                  <span className="gantt-grid-cell-text">{task.name}</span>
                  {row.tasks.length > 1 && (
                    <span className="gantt-grid-lane-count">
                      +{row.tasks.length - 1}
                    </span>
                  )}
              </div>
            </div>
          );
        })}

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
          />
        )}
      </div>
    </div>
  );
}
