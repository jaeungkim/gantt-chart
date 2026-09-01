import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "stores/context";

/**
 * Hook selecting the state and actions needed from the Gantt store
 * Uses shallow comparison to avoid unnecessary re-renders
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

      // Actions
      syncTasksFromProps: state.syncTasksFromProps,
      setHistoryLimit: state.setHistoryLimit,
      setTransformedTasks: state.setTransformedTasks,
      setBottomRowCells: state.setBottomRowCells,
      setSelectedScale: state.setSelectedScale,
      setLocaleOptions: state.setLocaleOptions,
      clearAllDragOffsets: state.clearAllDragOffsets,

      // Computed values
      getTotalWidth: state.getTotalWidth,
    }))
  );
}
