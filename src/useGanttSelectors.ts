import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "shared/context";

export function useGanttSelectors() {
  return useGanttStore(
    useShallow((state) => ({
      rawTasks: state.rawTasks,
      transformedTasks: state.transformedTasks,
      bottomRowCells: state.bottomRowCells,
      selectedScale: state.selectedScale,

      syncTasksFromProps: state.syncTasksFromProps,
    }))
  );
}
