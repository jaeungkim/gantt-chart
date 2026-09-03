import { DEFAULT_GRID_WIDTH } from "shared/constants";
import { useState } from "react";

interface UseGanttTaskListPaneParams {
  showTaskList?: boolean;
}

interface GanttTaskListPane {
  width: number;
  setWidth: (width: number) => void;
  visible: boolean;
  // Timeline px the pane covers; scroll and zoom math subtracts it so `scrollToDate` clears it
  inset: number;
}

export function useGanttTaskListPane({
  showTaskList,
}: UseGanttTaskListPaneParams): GanttTaskListPane {
  const visible = showTaskList ?? false;
  const [width, setWidth] = useState(DEFAULT_GRID_WIDTH);

  return {
    width,
    setWidth,
    visible,
    inset: visible ? width : 0,
  };
}
