import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "stores/store";

/**
 * Gantt 스토어에서 필요한 상태와 액션을 선택하는 훅
 * shallow 비교를 사용하여 불필요한 리렌더링 방지
 */
export function useGanttSelectors() {
  return useGanttStore(
    useShallow((state) => ({
      // 상태
      rawTasks: state.rawTasks,
      transformedTasks: state.transformedTasks,
      bottomRowCells: state.bottomRowCells,
      selectedScale: state.selectedScale,
      currentTask: state.currentTask,
      dragOffsets: state.dragOffsets,

      // 액션
      setRawTasks: state.setRawTasks,
      setTransformedTasks: state.setTransformedTasks,
      setBottomRowCells: state.setBottomRowCells,
      setSelectedScale: state.setSelectedScale,
      setCurrentTask: state.setCurrentTask,
      setDragOffset: state.setDragOffset,
      clearDragOffset: state.clearDragOffset,

      // 계산된 값
      getTotalWidth: state.getTotalWidth,
      getCurrentDragOffset: state.getCurrentDragOffset,
    }))
  );
}
