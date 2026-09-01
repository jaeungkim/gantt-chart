import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { GanttState, GanttStoreApi } from "./store";

/** 인스턴스별 스토어를 하위 컴포넌트에 전달 */
export const GanttStoreContext = createContext<GanttStoreApi | null>(null);

function useStoreApi(): GanttStoreApi {
  const store = useContext(GanttStoreContext);
  if (!store) {
    throw new Error(
      "Gantt store is missing. Render this component inside <ReactGanttChart>."
    );
  }
  return store;
}

/** 이 인스턴스의 스토어를 구독한다 */
export function useGanttStore<T>(selector: (state: GanttState) => T): T {
  return useStore(useStoreApi(), selector);
}

/**
 * 구독 없이 스토어 API만 가져온다 (이벤트 핸들러 안에서 getState/setState 용)
 * 렌더 중 값을 읽는 데 쓰면 안 된다 - 그때는 useGanttStore를 쓴다.
 */
export function useGanttStoreApi(): GanttStoreApi {
  return useStoreApi();
}
