import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "stores/context";

/**
 * The store state the chart component itself renders with
 *
 * Shallow comparison, so a change to anything not listed here does not re-render the
 * chart. Anything only one feature needs is subscribed to by that feature's own hook
 * instead of being added here.
 *
 * dragOffsets/currentTask change on every drag frame and are deliberately not
 * subscribed to here. (Components that need them subscribe individually - this keeps
 * the whole chart from re-rendering every frame)
 */
export function useGanttSelectors() {
  return useGanttStore(
    useShallow((state) => ({
      // State
      rawTasks: state.rawTasks,
      transformedTasks: state.transformedTasks,
      bottomRowCells: state.bottomRowCells,
      selectedScale: state.selectedScale,
      selectedTaskId: state.selectedTaskId,

      // Actions
      syncTasksFromProps: state.syncTasksFromProps,
      setHistoryLimit: state.setHistoryLimit,
      setSelectedScale: state.setSelectedScale,
      setLocaleOptions: state.setLocaleOptions,

      // Computed values
      getTotalWidth: state.getTotalWidth,
    }))
  );
}
