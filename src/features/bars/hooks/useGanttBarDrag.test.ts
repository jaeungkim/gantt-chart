import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createWorkingCalendar, type WorkingCalendar } from "core/calendar";
import dayjs from "core/dates";
import { GANTT_SCALE_CONFIG } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type {
  GanttInteractionConfig,
  Task,
  TaskTransformed,
} from "shared/task";
import type { GanttVisibleRange } from "shared/types";
import { TOUCH_LONG_PRESS_MS } from "shared/utils/pointerGesture";
import { computeTimelineData } from "features/timeline/utils/geometry";
import { useGanttBarDrag } from "./useGanttBarDrag";

// Effects never run under renderToString, so each is kept for a test that mounts and unmounts
const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (create: () => void | (() => void)) => void effects.push(create),
}));

const STEP_PX = GANTT_SCALE_CONFIG.month.basePxPerDragStep; // one day

const task = (id: string, startDate: string, endDate: string): Task => ({
  id,
  name: id,
  parentId: null,
  sequence: "1",
  startDate,
  endDate,
});

interface BarSetup {
  calendar?: WorkingCalendar;
  interaction?: GanttInteractionConfig;
  range?: GanttVisibleRange;
  hierarchy?: boolean;
  // The scroll container the bar sits in; auto-scroll runs only with one
  scrollEl?: object;
}

type BarDrag = ReturnType<typeof useGanttBarDrag>;

function Probe(props: {
  bar: TaskTransformed;
  setup: BarSetup;
  onTasksChange: (tasks: Task[]) => void;
  expose: (hook: BarDrag) => void;
}) {
  const { bar, setup, onTasksChange, expose } = props;
  expose(
    useGanttBarDrag(
      bar,
      { onTasksChange, autoScroll: setup.scrollEl !== undefined },
      setup.interaction,
      setup.calendar
    )
  );
  return null;
}

// Renders the real hook once for its handlers, against a real store at the month scale.
function mountBar(tasks: Task[], id: string, setup: BarSetup = {}) {
  const store = createGanttStore("month");
  const { bottomCells, transformedTasks } = computeTimelineData(
    tasks,
    "month",
    setup.range,
    setup.hierarchy
  );
  store.getState().setRawTasks(tasks);
  store.getState().setBottomRowCells(bottomCells);
  store.getState().setTransformedTasks(transformedTasks);
  const bar = transformedTasks.find((t) => t.id === id)!;
  const onTasksChange = vi.fn();

  let hook!: BarDrag;
  renderToString(
    createElement(
      GanttStoreContext.Provider,
      { value: store },
      createElement(Probe, {
        bar,
        setup,
        onTasksChange,
        expose: (h) => (hook = h),
      })
    )
  );

  const element = {
    getBoundingClientRect: () => ({ left: bar.barLeft, width: bar.barWidth }),
    closest: () => setup.scrollEl ?? null,
    setPointerCapture: () => {},
  };
  const press = (clientX: number, pointerType = "mouse", pointerId = 1) =>
    hook.onPointerDown({
      isPrimary: true,
      button: 0,
      pointerType,
      pointerId,
      clientX,
      clientY: 0,
      currentTarget: element,
    } as never);

  const committed = (taskId = id) =>
    store.getState().rawTasks.find((t) => t.id === taskId)!;

  return {
    store,
    bar,
    hook,
    onTasksChange,
    press,
    committed,
    leftEdge: bar.barLeft + 1,
    middle: bar.barLeft + bar.barWidth / 2,
    rightEdge: bar.barLeft + bar.barWidth - 1,
  };
}

const fire = (type: string, clientX: number, pointerId = 1) =>
  document.dispatchEvent(
    Object.assign(new Event(type), { pointerId, clientX, clientY: 0 })
  );

const drag = (bar: ReturnType<typeof mountBar>, fromX: number, steps: number) => {
  bar.press(fromX);
  fire("pointermove", fromX + steps * STEP_PX);
  fire("pointerup", fromX + steps * STEP_PX);
};

beforeEach(() => {
  vi.stubGlobal("document", new EventTarget());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("working-calendar right resize", () => {
  // The docs' WorkWeekChart: Mon to Fri with Fri 2026-09-25 off; audit covers Tue to Thu.
  const calendar = createWorkingCalendar({ holidays: ["2026-09-25"] });
  const audit = task("audit", "2026-09-01", "2026-09-04");

  const resizeEnd = (t: Task, steps: number) => {
    const bar = mountBar([t], t.id, { calendar });
    drag(bar, bar.rightEdge, steps);
    return bar.committed().endDate;
  };

  it("keeps an end that closes the last working day before a weekend", () => {
    expect(resizeEnd(audit, 1)).toBe("2026-09-05T00:00:00.000Z");
  });

  it("keeps an end that closes the last working day before a holiday", () => {
    const week = task("week", "2026-09-21", "2026-09-24");
    expect(resizeEnd(week, 1)).toBe("2026-09-25T00:00:00.000Z");
  });

  it("snaps an end that closes a weekend day forward to the end of Monday", () => {
    expect(resizeEnd(audit, 2)).toBe("2026-09-08T00:00:00.000Z");
    expect(resizeEnd(audit, 3)).toBe("2026-09-08T00:00:00.000Z");
  });
});

describe("the click after a drag", () => {
  const plan = task("plan", "2025-01-06", "2025-01-16");

  const touchDrag = (bar: ReturnType<typeof mountBar>, end: string) => {
    bar.press(bar.middle, "touch");
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);
    fire("pointermove", bar.middle + 2 * STEP_PX);
    fire(end, bar.middle + 2 * STEP_PX);
  };

  // A browser sends no click after a touch drag, so the next tap is the first click.
  const tap = (bar: ReturnType<typeof mountBar>) => {
    bar.press(bar.middle, "touch", 2);
    fire("pointerup", bar.middle, 2);
    return !bar.hook.consumeDragClick();
  };

  it("lets the first tap after a touch drag through", () => {
    vi.useFakeTimers();
    const bar = mountBar([plan], "plan");
    touchDrag(bar, "pointerup");

    expect(bar.onTasksChange).toHaveBeenCalledTimes(1);
    expect(tap(bar)).toBe(true);
  });

  it("lets the first tap after a cancelled touch drag through", () => {
    vi.useFakeTimers();
    const bar = mountBar([plan], "plan");
    touchDrag(bar, "pointercancel");

    expect(bar.onTasksChange).not.toHaveBeenCalled();
    expect(tap(bar)).toBe(true);
  });

  it("still drops the click that closes a mouse drag", () => {
    const bar = mountBar([plan], "plan");
    drag(bar, bar.middle, 2);

    expect(bar.hook.consumeDragClick()).toBe(true);
    expect(bar.hook.consumeDragClick()).toBe(false);
  });
});

describe("resizing a bar clipped by a pinned window", () => {
  // Month ticks are whole weeks, so this window draws 2026-03-01 to 2026-05-03.
  const range = { start: dayjs("2026-03-01"), end: dayjs("2026-04-30") };

  it("commits the start under the dragged edge, not the hidden start shifted", () => {
    const bar = mountBar([task("a", "2026-02-20", "2026-03-10")], "a", { range });
    expect(bar.bar.barLeft).toBe(0);

    drag(bar, bar.leftEdge, 3);
    expect(bar.committed().startDate).toBe("2026-03-04T00:00:00.000Z");
  });

  it("commits the end under the dragged edge, not the hidden end shifted", () => {
    const bar = mountBar([task("b", "2026-04-20", "2026-05-20")], "b", { range });

    drag(bar, bar.rightEdge, -3);
    expect(bar.committed().endDate).toBe("2026-04-30T00:00:00.000Z");
  });

  it.each([
    ["start", task("a", "2026-02-20", "2026-03-10"), "leftEdge", -3, "2026-02-20"],
    ["end", task("b", "2026-04-20", "2026-05-20"), "rightEdge", 3, "2026-05-20"],
  ] as const)("keeps a clipped %s when its edge is dragged outward", (key, t, edge, steps, kept) => {
    const bar = mountBar([t], t.id, { range });
    drag(bar, bar[edge], steps);

    expect(bar.committed()[`${key}Date`]).toBe(kept);
    expect(bar.onTasksChange).not.toHaveBeenCalled();
  });
});

describe("dragging a bar whose stored dates do not parse", () => {
  const phase: Task[] = [
    task("p", "", ""),
    { ...task("c1", "2026-09-01", "2026-09-08"), parentId: "p", sequence: "1.1" },
    { ...task("c2", "2026-09-08", "2026-09-18"), parentId: "p", sequence: "1.2" },
  ];
  const openEnded: Task[] = [
    task("x", "2026-09-01", ""),
    { ...task("y", "2026-09-01", "2026-10-01"), sequence: "2" },
  ];

  it.each([
    ["unbounded", undefined],
    ["bounded", { maxDate: "2030-01-01" }],
  ])("moves a summary's subtree and keeps its placeholder dates (%s)", (_, interaction) => {
    const bar = mountBar(phase, "p", { hierarchy: true, interaction });
    drag(bar, bar.middle, 3);

    expect(bar.onTasksChange).toHaveBeenCalledTimes(1);
    expect(bar.committed("p")).toMatchObject({ startDate: "", endDate: "" });
    expect(bar.committed("c1").startDate).toBe("2026-09-04T00:00:00.000Z");
    expect(bar.store.getState().barDrag).toBeNull();
  });

  it("moves a leaf with an open end and keeps the end open", () => {
    const bar = mountBar(openEnded, "x");
    drag(bar, bar.middle, 3);

    expect(bar.committed()).toMatchObject({
      startDate: "2026-09-04T00:00:00.000Z",
      endDate: "",
    });
  });

  it.each([
    ["working calendar", { calendar: createWorkingCalendar() }],
    ["minDate", { interaction: { minDate: "2026-01-01" } }],
  ])("moves a leaf with an open start and keeps the start open (%s)", (_, setup) => {
    const openStart = [task("s", "", "2026-09-10"), openEnded[1]];
    const bar = mountBar(openStart, "s", setup);
    drag(bar, bar.middle, 1);

    expect(bar.onTasksChange).toHaveBeenCalledTimes(1);
    expect(bar.committed().startDate).toBe("");
    expect(bar.store.getState().barDrag).toBeNull();
  });

  it("gives an open end the date its edge is dropped on", () => {
    const bar = mountBar(openEnded, "x");
    drag(bar, bar.rightEdge, -3);

    // The timeline is drawn to 2026-11-08, where the open end is drawn.
    expect(bar.committed().endDate).toBe("2026-11-05T00:00:00.000Z");
  });
});

describe("dragging back to the press point", () => {
  const saturday = task("sat", "2026-09-05", "2026-09-09");

  // Returns the start the bar and the header readout show just before release.
  const outAndBack = (bar: ReturnType<typeof mountBar>, x: number) => {
    bar.press(x);
    fire("pointermove", x + STEP_PX);
    fire("pointermove", x);
    const offset = bar.store.getState().dragOffsets[bar.bar.id];
    const shown = offset?.offsetStartDate ?? dayjs(bar.bar.startDate);
    fire("pointerup", x);
    return shown.toISOString();
  };

  it("shows and keeps a weekend start the working calendar would snap", () => {
    const bar = mountBar([saturday], "sat", { calendar: createWorkingCalendar() });

    expect(outAndBack(bar, bar.middle)).toBe(dayjs(bar.committed().startDate).toISOString());
    expect(bar.onTasksChange).not.toHaveBeenCalled();
  });

  it("shows and keeps a start already before its minDate", () => {
    const bar = mountBar([{ ...saturday, minDate: "2026-09-07" }], "sat");

    expect(outAndBack(bar, bar.leftEdge)).toBe(dayjs(bar.committed().startDate).toISOString());
    expect(bar.onTasksChange).not.toHaveBeenCalled();
  });
});

describe("undoing a cancelled drag's auto-scroll", () => {
  // Returns the behavior the cancel scrolls back with, after one frame of auto-scroll
  const undoBehavior = (reduceMotion: boolean) => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: reduceMotion && query === "(prefers-reduced-motion: reduce)",
      }),
    });
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const undo: ScrollToOptions[] = [];
    const scrollEl = {
      scrollLeft: 0,
      getBoundingClientRect: () => ({ left: 0, right: 1000 }),
      querySelector: () => null,
      scrollBy: (options: ScrollToOptions) => undo.push(options),
    };

    const bar = mountBar([task("plan", "2025-01-06", "2025-01-16")], "plan", { scrollEl });
    bar.press(bar.middle);
    fire("pointermove", 995); // in the right edge's auto-scroll zone
    frame?.(0);
    fire("pointercancel", 995);
    return undo.map((options) => options.behavior);
  };

  it("animates the way back by default", () => {
    expect(undoBehavior(false)).toEqual(["smooth"]);
  });

  it("jumps back when the user prefers reduced motion", () => {
    expect(undoBehavior(true)).toEqual(["auto"]);
  });
});

describe("a bar unmounted mid-drag", () => {
  it("drops the drag instead of committing it on the release", () => {
    effects.length = 0;
    const bar = mountBar([task("plan", "2025-01-06", "2025-01-16")], "plan");
    const unmount = effects.map((create) => create());
    bar.press(bar.middle);
    fire("pointermove", bar.middle + 2 * STEP_PX);
    unmount.forEach((cleanup) => cleanup?.());
    fire("pointerup", bar.middle + 2 * STEP_PX);

    expect(bar.onTasksChange).not.toHaveBeenCalled();
    expect(bar.store.getState().barDrag).toBeNull();
    expect(bar.store.getState().dragOffsets).toEqual({});
  });
});
