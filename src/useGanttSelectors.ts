import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "shared/context";

// Store state the chart component itself renders with; anything one feature needs is
// subscribed to by that feature's hook. dragOffsets/currentTask are excluded on purpose -
// they change every drag frame and would re-render the whole chart.
export function useGanttSelectors() {
  return useGanttStore(
    useShallow((state) => ({
      rawTasks: state.rawTasks,
      transformedTasks: state.transformedTasks,
      bottomRowCells: state.bottomRowCells,
      selectedScale: state.selectedScale,
      selectedTaskId: state.selectedTaskId,

      syncTasksFromProps: state.syncTasksFromProps,
      setSelectedScale: state.setSelectedScale,
      setLocaleOptions: state.setLocaleOptions,

      getTotalWidth: state.getTotalWidth,
    }))
  );
}
