import { DEFAULT_GRID_WIDTH } from "shared/constants";
import { useState } from "react";

interface UseGanttTaskListPaneParams {
  showTaskList?: boolean;
}

export interface GanttTaskListPane {
  width: number;
  setWidth: (width: number) => void;
  visible: boolean;
  // How much of the timeline the pinned pane covers (px) - scroll and zoom math subtracts
  // it, so a date centred by `scrollToDate` does not land behind the pane
  inset: number;
}

// The pane shows the task name and nothing else, so `showTaskList` is the whole
// configuration - off by default.
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
