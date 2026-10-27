import { describe, expect, it, vi } from "vitest";
import { createGanttStore } from "shared/store";
import type { TaskTransformed } from "shared/task";
import { useGanttSelection } from "./useGanttSelection";

const hooks = vi.hoisted(() => ({ store: null as unknown }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useContext: () => hooks.store,
    useCallback: <T>(fn: T) => fn,
    useLayoutEffect: (effect: () => void) => effect(),
  };
});

const a = { id: "a" } as TaskTransformed;
const onTaskSelect = vi.fn();

describe("turning selection off", () => {
  it.each([
    ["selectable turns false", { selectable: false, onTaskSelect }],
    ["the detail panel that turned it on turns off", { selectable: undefined }],
  ])("clears the highlight without calling onTaskSelect when %s", (_, off) => {
    const store = createGanttStore();
    hooks.store = store;
    useGanttSelection({ selectable: true, onTaskSelect })(a);
    expect(store.getState().selectedTaskId).toBe("a");
    onTaskSelect.mockClear();

    useGanttSelection(off);

    expect(store.getState().selectedTaskId).toBeNull();
    expect(onTaskSelect).not.toHaveBeenCalled();
  });
});
