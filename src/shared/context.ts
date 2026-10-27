import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { GanttState, GanttStoreApi } from "./store";

export const GanttStoreContext = createContext<GanttStoreApi | null>(null);

export function useGanttStoreApi(): GanttStoreApi {
  const store = useContext(GanttStoreContext);
  if (!store) {
    throw new Error(
      "Gantt store is missing. Render this component inside <ReactGanttChart>."
    );
  }
  return store;
}

export function useGanttStore<T>(selector: (state: GanttState) => T): T {
  return useStore(useGanttStoreApi(), selector);
}
