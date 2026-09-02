import { DEFAULT_COLUMN_WIDTH, DEFAULT_COLUMNS } from "constants/gantt";
import { useCallback, useState } from "react";
import { GanttColumn } from "types/gantt";

interface UseGanttTaskListPaneParams {
  /** Column definitions, or undefined for the built-in Name / Start / End set */
  columns?: GanttColumn[];
  /** Explicit override - undefined lets `columns` decide whether the pane appears */
  showTaskList?: boolean;
}

export interface GanttTaskListPane {
  columns: GanttColumn[];
  /** Whether the chart has a task list at all - the toggle button appears only then */
  enabled: boolean;
  collapsed: boolean;
  toggleCollapsed: () => void;
  width: number;
  setWidth: (width: number) => void;
  /** Enabled and not collapsed - what the render actually keys off */
  visible: boolean;
  /**
   * How much of the timeline the pinned pane covers (px)
   *
   * Scroll and zoom math treats the viewport as that much narrower, so a date
   * centred by `scrollToDate` does not land behind the pane.
   */
  inset: number;
}

/**
 * State of the task list pane on the left
 *
 * Without an explicit `showTaskList`, the pane appears exactly when `columns` are
 * given - so a chart that passes neither renders the timeline alone.
 */
export function useGanttTaskListPane({
  columns,
  showTaskList,
}: UseGanttTaskListPaneParams): GanttTaskListPane {
  const paneColumns = columns ?? DEFAULT_COLUMNS;
  const enabled = showTaskList ?? columns !== undefined;

  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
  const [width, setWidth] = useState(() =>
    paneColumns.reduce(
      (sum, column) => sum + (column.width ?? DEFAULT_COLUMN_WIDTH),
      0
    )
  );

  const visible = enabled && !collapsed;

  return {
    columns: paneColumns,
    enabled,
    collapsed,
    toggleCollapsed,
    width,
    setWidth,
    visible,
    inset: visible ? width : 0,
  };
}
