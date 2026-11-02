// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Gantt from "Gantt";
import type { Task } from "core/types";
import { GANTT_SCALE_CONFIG } from "shared/constants";
import { TOUCH_LONG_PRESS_MS } from "shared/utils/pointerGesture";
import { click, pointer, render } from "shared/testing/dom";

const STEP_PX = GANTT_SCALE_CONFIG.month.basePxPerDragStep;

const task = (id: string, startDate: string, endDate: string): Task => ({
  id,
  name: id,
  parentId: null,
  sequence: "1",
  startDate,
  endDate,
});

const barLeftOf = (el: HTMLElement) =>
  Number(/translateX\((-?[\d.]+)px\)/.exec(el.style.transform)![1]);

const laidOut = (el: HTMLElement) => {
  el.getBoundingClientRect = () => new DOMRect(barLeftOf(el), 0, parseFloat(el.style.width), 0);
  return el;
};

async function mountGantt(tasks: Task[], props: Partial<ComponentProps<typeof Gantt>> = {}) {
  const onTasksChange = vi.fn<(tasks: Task[]) => void>();
  const onTaskClick = vi.fn();
  const element = (next: Task[]) =>
    createElement(Gantt, {
      tasks: next,
      defaultScale: "month",
      onTasksChange,
      onTaskClick,
      ...props,
    });
  const { host, rerender } = await render(element(tasks));
  const bar = (id: string) =>
    laidOut(host.querySelector<HTMLElement>(`.gantt-task-bar[data-task-id="${id}"]`)!);
  const committed = (id: string) => onTasksChange.mock.lastCall![0].find((t) => t.id === id)!;
  return {
    host,
    bar,
    committed,
    onTasksChange,
    onTaskClick,
    rerender: (next: Task[]) => rerender(element(next)),
  };
}

const edges = (el: HTMLElement) => {
  const left = barLeftOf(el);
  const width = parseFloat(el.style.width);
  return { leftEdge: left + 1, middle: left + width / 2, rightEdge: left + width - 1 };
};

const drag = async (el: HTMLElement, fromX: number, steps: number) => {
  await pointer("pointerdown", el, fromX, 0);
  await pointer("pointermove", document, fromX + steps * STEP_PX, 0);
  await pointer("pointerup", document, fromX + steps * STEP_PX, 0);
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("working-calendar right resize", () => {
  const holidays = ["2026-09-25"];
  const audit = task("audit", "2026-09-01", "2026-09-04");

  const resizeEnd = async (t: Task, steps: number) => {
    const gantt = await mountGantt([t], { workingCalendar: true, holidays });
    const el = gantt.bar(t.id);
    await drag(el, edges(el).rightEdge, steps);
    return gantt.committed(t.id).endDate;
  };

  it("keeps an end that closes the last working day before a weekend", async () => {
    expect(await resizeEnd(audit, 1)).toBe("2026-09-05T00:00:00.000Z");
  });

  it("keeps an end that closes the last working day before a holiday", async () => {
    const week = task("week", "2026-09-21", "2026-09-24");
    expect(await resizeEnd(week, 1)).toBe("2026-09-25T00:00:00.000Z");
  });

  it("snaps an end that closes a weekend day forward to the end of Monday", async () => {
    expect(await resizeEnd(audit, 2)).toBe("2026-09-08T00:00:00.000Z");
    expect(await resizeEnd(audit, 3)).toBe("2026-09-08T00:00:00.000Z");
  });
});

describe("the click after a drag", () => {
  const plan = task("plan", "2025-01-06", "2025-01-16");

  const touchDrag = async (el: HTMLElement, end: "pointerup" | "pointercancel") => {
    const { middle } = edges(el);
    const touch = { pointerType: "touch" };
    await pointer("pointerdown", el, middle, 0, touch);
    await act(async () => vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS));
    await pointer("pointermove", document, middle + 2 * STEP_PX, 0, touch);
    await pointer(end, document, middle + 2 * STEP_PX, 0, touch);
  };

  const tap = async (el: HTMLElement) => {
    const { middle } = edges(el);
    const touch = { pointerType: "touch", pointerId: 2 };
    await pointer("pointerdown", el, middle, 0, touch);
    await pointer("pointerup", document, middle, 0, touch);
    await click(el);
  };

  it("lets the first tap after a touch drag through", async () => {
    const gantt = await mountGantt([plan]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await touchDrag(gantt.bar("plan"), "pointerup");
    expect(gantt.onTasksChange).toHaveBeenCalledTimes(1);

    await tap(gantt.bar("plan"));
    expect(gantt.onTaskClick).toHaveBeenCalledTimes(1);
  });

  it("lets the first tap after a cancelled touch drag through", async () => {
    const gantt = await mountGantt([plan]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await touchDrag(gantt.bar("plan"), "pointercancel");
    expect(gantt.onTasksChange).not.toHaveBeenCalled();

    await tap(gantt.bar("plan"));
    expect(gantt.onTaskClick).toHaveBeenCalledTimes(1);
  });

  it("still drops the click that closes a mouse drag", async () => {
    const gantt = await mountGantt([plan]);
    const el = gantt.bar("plan");
    await drag(el, edges(el).middle, 2);

    await click(el);
    expect(gantt.onTaskClick).not.toHaveBeenCalled();
    await click(el);
    expect(gantt.onTaskClick).toHaveBeenCalledTimes(1);
  });
});

describe("resizing a bar clipped by a pinned window", () => {
  const pinned = { visibleStart: "2026-03-01", visibleEnd: "2026-04-30" };

  it("commits the start under the dragged edge, not the hidden start shifted", async () => {
    const gantt = await mountGantt([task("a", "2026-02-20", "2026-03-10")], pinned);
    const el = gantt.bar("a");
    expect(barLeftOf(el)).toBe(0);

    await drag(el, edges(el).leftEdge, 3);
    expect(gantt.committed("a").startDate).toBe("2026-03-04T00:00:00.000Z");
  });

  it("commits the end under the dragged edge, not the hidden end shifted", async () => {
    const gantt = await mountGantt([task("b", "2026-04-20", "2026-05-20")], pinned);
    const el = gantt.bar("b");

    await drag(el, edges(el).rightEdge, -3);
    expect(gantt.committed("b").endDate).toBe("2026-04-30T00:00:00.000Z");
  });

  it.each([
    ["start", task("a", "2026-02-20", "2026-03-10"), "leftEdge", -3],
    ["end", task("b", "2026-04-20", "2026-05-20"), "rightEdge", 3],
  ] as const)("keeps a clipped %s when its edge is dragged outward", async (_, t, edge, steps) => {
    const gantt = await mountGantt([t], pinned);
    const el = gantt.bar(t.id);
    await drag(el, edges(el)[edge], steps);

    expect(gantt.onTasksChange).not.toHaveBeenCalled();
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
    ["unbounded", {}],
    ["bounded", { maxDate: "2030-01-01" }],
  ])("moves a summary's subtree and keeps its placeholder dates (%s)", async (_, bounds) => {
    const gantt = await mountGantt(phase, { hierarchy: true, ...bounds });
    const el = gantt.bar("p");
    await drag(el, edges(el).middle, 3);

    expect(gantt.onTasksChange).toHaveBeenCalledTimes(1);
    expect(gantt.committed("p")).toMatchObject({ startDate: "", endDate: "" });
    expect(gantt.committed("c1").startDate).toBe("2026-09-04T00:00:00.000Z");
    expect(gantt.bar("p").classList.contains("dragging")).toBe(false);
  });

  it("moves a leaf with an open end and keeps the end open", async () => {
    const gantt = await mountGantt(openEnded);
    const el = gantt.bar("x");
    await drag(el, edges(el).middle, 3);

    expect(gantt.committed("x")).toMatchObject({
      startDate: "2026-09-04T00:00:00.000Z",
      endDate: "",
    });
  });

  it.each([
    ["working calendar", { workingCalendar: true }],
    ["minDate", { minDate: "2026-01-01" }],
  ])("moves a leaf with an open start and keeps the start open (%s)", async (_, props) => {
    const gantt = await mountGantt([task("s", "", "2026-09-10"), openEnded[1]], props);
    const el = gantt.bar("s");
    await drag(el, edges(el).middle, 1);

    expect(gantt.onTasksChange).toHaveBeenCalledTimes(1);
    expect(gantt.committed("s").startDate).toBe("");
    expect(gantt.bar("s").classList.contains("dragging")).toBe(false);
  });

  it("gives an open end the date its edge is dropped on", async () => {
    const gantt = await mountGantt(openEnded);
    const el = gantt.bar("x");
    await drag(el, edges(el).rightEdge, -3);

    expect(gantt.committed("x").endDate).toBe("2026-11-05T00:00:00.000Z");
  });
});

describe("dragging back to the press point", () => {
  const saturday = task("sat", "2026-09-05", "2026-09-09");

  const outAndBack = async (gantt: Awaited<ReturnType<typeof mountGantt>>, x: number) => {
    const el = gantt.bar("sat");
    const restingLeft = barLeftOf(el);
    const restingWidth = el.style.width;
    await pointer("pointerdown", el, x, 0);
    await pointer("pointermove", document, x + STEP_PX, 0);
    await pointer("pointermove", document, x, 0);
    const shown = {
      left: barLeftOf(el) - restingLeft,
      width: el.style.width === restingWidth,
      guides: gantt.host.querySelector(".gantt-drag-guides") !== null,
    };
    await pointer("pointerup", document, x, 0);
    return shown;
  };

  it("shows and keeps a weekend start the working calendar would snap", async () => {
    const gantt = await mountGantt([saturday], { workingCalendar: true });

    expect(await outAndBack(gantt, edges(gantt.bar("sat")).middle)).toEqual({
      left: 0,
      width: true,
      guides: false,
    });
    expect(gantt.onTasksChange).not.toHaveBeenCalled();
  });

  it("shows and keeps a start already before its minDate", async () => {
    const gantt = await mountGantt([{ ...saturday, minDate: "2026-09-07" }]);

    expect(await outAndBack(gantt, edges(gantt.bar("sat")).leftEdge)).toEqual({
      left: 0,
      width: true,
      guides: false,
    });
    expect(gantt.onTasksChange).not.toHaveBeenCalled();
  });
});

describe("undoing a cancelled drag's auto-scroll", () => {
  const undoBehavior = async (reduceMotion: boolean) => {
    const gantt = await mountGantt([task("plan", "2025-01-06", "2025-01-16")]);
    const scrollEl = gantt.host.querySelector<HTMLElement>(".gantt-scroll-container")!;
    let scrollLeft = 0;
    Object.defineProperty(scrollEl, "scrollLeft", {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    });
    scrollEl.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 400);
    const undo: ScrollToOptions[] = [];
    scrollEl.scrollBy = ((options: ScrollToOptions) => undo.push(options)) as typeof scrollEl.scrollBy;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: reduceMotion && query === "(prefers-reduced-motion: reduce)",
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const el = gantt.bar("plan");
    const inRightAutoScrollZone = 995;
    await pointer("pointerdown", el, edges(el).middle, 0);
    await pointer("pointermove", document, inRightAutoScrollZone, 0);
    await act(async () => frames.splice(0).forEach((frame) => frame(0)));
    await pointer("pointercancel", document, inRightAutoScrollZone, 0);
    return undo.map((options) => options.behavior);
  };

  it("animates the way back by default", async () => {
    expect(await undoBehavior(false)).toEqual(["smooth"]);
  });

  it("jumps back when the user prefers reduced motion", async () => {
    expect(await undoBehavior(true)).toEqual(["auto"]);
  });
});

describe("a bar unmounted mid-drag", () => {
  it("drops the drag instead of committing it on the release", async () => {
    const plan = task("plan", "2025-01-06", "2025-01-16");
    const gantt = await mountGantt([plan]);
    const el = gantt.bar("plan");
    const restingTransform = el.style.transform;
    const { middle } = edges(el);
    await pointer("pointerdown", el, middle, 0);
    await pointer("pointermove", document, middle + 2 * STEP_PX, 0);
    await gantt.rerender([]);
    await pointer("pointerup", document, middle + 2 * STEP_PX, 0);
    expect(gantt.onTasksChange).not.toHaveBeenCalled();

    await gantt.rerender([plan]);
    const remounted = gantt.bar("plan");
    expect(remounted.classList.contains("dragging")).toBe(false);
    expect(remounted.style.transform).toBe(restingTransform);
  });
});
