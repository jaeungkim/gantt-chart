import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { GanttState, GanttStoreApi } from "./store";

/** Passes the per-instance store down to child components */
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

/** Subscribes to this instance's store */
export function useGanttStore<T>(selector: (state: GanttState) => T): T {
  return useStore(useStoreApi(), selector);
}

/**
 * Returns the store API without subscribing (for getState/setState inside event handlers)
 * Must not be used to read values during render - use useGanttStore for that.
 */
export function useGanttStoreApi(): GanttStoreApi {
  return useStoreApi();
}
