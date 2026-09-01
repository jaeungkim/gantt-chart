import { useShallow } from "zustand/react/shallow";
import { useGanttStore } from "stores/context";

/**
 * Gantt 스토어에서 필요한 상태와 액션을 선택하는 훅
 * shallow 비교를 사용하여 불필요한 리렌더링 방지
 *
 * 드래그 프레임마다 바뀌는 dragOffsets/currentTask는 여기서 구독하지 않는다.
 * (필요한 컴포넌트에서 개별 구독 - 차트 전체가 매 프레임 리렌더되는 것을 방지)
 */
export function useGanttSelectors() {
  return useGanttStore(
    useShallow((state) => ({
      // 상태
      rawTasks: state.rawTasks,
      transformedTasks: state.transformedTasks,
      bottomRowCells: state.bottomRowCells,
      selectedScale: state.selectedScale,

      // 액션
      setRawTasks: state.setRawTasks,
      setTransformedTasks: state.setTransformedTasks,
      setBottomRowCells: state.setBottomRowCells,
      setSelectedScale: state.setSelectedScale,
      clearAllDragOffsets: state.clearAllDragOffsets,

      // 계산된 값
      getTotalWidth: state.getTotalWidth,
    }))
  );
}
