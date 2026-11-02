// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore, type GanttStoreApi } from "shared/store";
import type { TaskTransformed } from "shared/task";
import { dispatch, pointer, render } from "shared/testing/dom";
import { stylesheet } from "shared/utils/stylesheet.test-utils";
import type { GanttBarOptions } from "shared/types";
import type { VirtualItem } from "shared/virtual/window";
import type { GanttRow } from "features/rows/utils/rows";
import GanttBarsLayer from "./GanttBarsLayer";

const css = stylesheet;

const geometry = resolveGeometry();
const { rowHeight } = geometry;
const task = (id: string, order: number, barLeft = 600, barWidth = 90): TaskTransformed => ({
  id,
  name: id,
  sequence: `${order}`,
  parentId: null,
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-06T00:00:00.000Z",
  barLeft,
  barWidth,
  depth: 0,
  order,
  originalOrder: order,
});
const rowWindow = (first: number, last: number): VirtualItem[] =>
  Array.from({ length: last - first + 1 }, (_, i) => ({
    index: first + i,
    start: (first + i) * rowHeight,
    size: rowHeight,
  }));

function renderLayer(
  rows: GanttRow[],
  virtualItems: VirtualItem[],
  isBarVisible: (left: number, width: number) => boolean,
  prepare: (store: GanttStoreApi) => void = () => {}
) {
  const store = createGanttStore("month");
  store.getInitialState = store.getState;
  prepare(store);
  return renderToStaticMarkup(
    createElement(
      GanttStoreContext.Provider,
      { value: store },
      createElement(GanttBarsLayer, {
        rows,
        virtualItems,
        isBarVisible,
        options: {} as GanttBarOptions,
        interaction: {},
        autoScrollOnDrag: true,
        geometry,
      })
    )
  );
}

const liveLayer = () => {
  const store = createGanttStore("month");
  store.getInitialState = store.getState;
  const parent = { ...task("p", 1), isSummary: true };
  const child = { ...task("a", 2), parentId: "p", depth: 1 };
  const rows = [parent, child].map((t) => ({ id: t.id, tasks: [t], depth: t.depth }));
  return render(
    createElement(
      GanttStoreContext.Provider,
      { value: store },
      createElement(GanttBarsLayer, {
        rows,
        virtualItems: rowWindow(0, 1),
        isBarVisible: () => true,
        options: {} as GanttBarOptions,
        interaction: {},
        autoScrollOnDrag: true,
        geometry,
      })
    )
  );
};

const barOf = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`.gantt-task-bar[data-task-id="${id}"]`)!;

const mouseOver = (target: Element) =>
  dispatch(target, new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));

describe("bar wrapper stacking", () => {
  it("wraps each bar directly in the element the lift rules select, and gives it the hovered and dragging states they match", async () => {
    expect(css).toContain(".gantt-bar-wrap:has(> .gantt-task-bar.hovered)");
    expect(css).toContain(".gantt-bar-wrap:has(> .gantt-task-bar.dragging)");
    const { host } = await liveLayer();
    const bars = [...host.querySelectorAll(".gantt-task-bar")];
    expect(bars.length).toBe(2);
    for (const bar of bars) expect(bar.parentElement!.classList).toContain("gantt-bar-wrap");

    const bar = barOf(host, "a");
    expect(bar.matches(".gantt-bar-wrap > .gantt-task-bar.hovered")).toBe(false);
    await mouseOver(bar);
    expect(bar.matches(".gantt-bar-wrap > .gantt-task-bar.hovered")).toBe(true);
    expect(bar.matches(".gantt-bar-wrap > .gantt-task-bar.dragging")).toBe(false);
    await pointer("pointerdown", bar, 10, 50);
    await pointer("pointermove", document, 80, 50);
    expect(bar.matches(".gantt-bar-wrap > .gantt-task-bar.dragging")).toBe(true);
  });

  it("carries no unmanaged stacking trigger on the wrapper, idle or mid-drag", async () => {
    const { host } = await liveLayer();
    const triggers = ["opacity", "filter", "will-change", "contain", "isolation"];
    const wrapperStyles = () =>
      [...host.querySelectorAll<HTMLElement>(".gantt-bar-wrap")].map((wrap) => wrap.style);
    const assertClean = () => {
      for (const style of wrapperStyles())
        for (const property of triggers) expect(style.getPropertyValue(property)).toBe("");
    };
    assertClean();
    const bar = barOf(host, "a");
    await mouseOver(bar);
    await pointer("pointerdown", bar, 10, 50);
    await pointer("pointermove", document, 80, 50);
    assertClean();
  });

  it("drives the lift off the store's mouse hover, not CSS :hover, which sticks after a tap", () => {
    expect(css).not.toContain(".gantt-bar-wrap:has(> .gantt-task-bar:hover)");
  });
});

describe("bar geometry has one source of truth", () => {
  it("leaves the draw ghost's height to the resolved geometry", () => {
    const ghost = css.slice(
      css.indexOf(".gantt-draw-ghost {"),
      css.indexOf("}", css.indexOf(".gantt-draw-ghost {"))
    );
    expect(ghost).not.toMatch(/height:\s*\d+px/);
    expect(ghost).not.toMatch(/margin-top:\s*\d+px/);
  });

  it("says roll-up with height, and leaves the fill free to be recolored", async () => {
    const { barHeight, summaryBarHeight } = resolveGeometry();
    expect(summaryBarHeight).toBeLessThan(barHeight);
    const { host } = await liveLayer();
    expect(barOf(host, "p").classList).toContain("summary");
    expect(barOf(host, "p").style.height).toBe(`${summaryBarHeight}px`);
    expect(barOf(host, "a").style.height).toBe(`${barHeight}px`);
    const summary = css.slice(
      css.indexOf(".gantt-task-bar.summary {"),
      css.indexOf("}", css.indexOf(".gantt-task-bar.summary {"))
    );
    expect(summary).not.toMatch(/height:/);
  });

  it("hands the drawn height to the link-handle pads, which span it", async () => {
    const { host } = await liveLayer();
    for (const id of ["p", "a"]) {
      const bar = barOf(host, id);
      expect(bar.querySelectorAll(".gantt-link-handle").length).toBeGreaterThan(0);
      expect(bar.style.getPropertyValue("--gantt-bar-height")).toBe(bar.style.height);
    }
    expect(css).toContain("var(--gantt-bar-height)");
  });
});

describe("a bar mid-drag stays mounted", () => {
  const tasks = Array.from({ length: 30 }, (_, i) => task(`t${i}`, i + 1));
  const rows = tasks.map((t) => ({ id: t.id, tasks: [t], depth: 0 }));
  const isBarVisible = (left: number, width: number) =>
    left + width >= 756 && left <= 3654;

  function renderDragging(virtualItems: VirtualItem[], dragged: TaskTransformed[]) {
    return renderLayer(rows, virtualItems, isBarVisible, (store) => {
      if (!dragged.length) return;
      store.getState().setBarDrag({ task: dragged[0], mode: "bar" });
      store
        .getState()
        .setDragOffsets(
          Object.fromEntries(dragged.map((t) => [t.id, { offsetX: 792, offsetWidth: 0 }]))
        );
    });
  }

  it("still culls an idle bar whose slot is outside the column window", () => {
    expect(renderDragging(rowWindow(0, 20), [])).not.toContain('data-task-id="t2"');
  });

  it("keeps the held bar, and a dragged summary's subtree, once auto-scroll passes their slots", () => {
    const html = renderDragging(rowWindow(0, 20), [tasks[2], tasks[3]]);
    expect(html).toContain('data-task-id="t2"');
    expect(html).toContain('data-task-id="t3"');
    expect(html).not.toContain('data-task-id="t4"');
  });

  it("keeps the held bar on its own row once that row scrolls out of the row window", () => {
    const html = renderDragging(rowWindow(10, 29), [tasks[2]]);
    expect(html).toContain(
      `transform:translateY(${2 * rowHeight}px)"><div data-task-id="t2"`
    );
  });
});

describe("lane neighbours keep their own edges", () => {
  const rules = (selector: string, within = css) =>
    [...within.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(",").map((s) => s.trim()).includes(selector))
      .map(([, , body]) => body);
  const handles = (html: string, id: string) =>
    [
      ...html
        .split(`data-task-id="${id}"`)[1]
        .split('data-task-id="')[0]
        .matchAll(/class="gantt-link-handle ([^"]*)"/g),
    ].map(([, anchor]) => anchor);

  it("marks the handles that face a lane neighbour within their hit pad's reach", () => {
    const lane = {
      id: "a+b+c",
      depth: 0,
      tasks: [task("a", 1, 666, 54), task("b", 1, 720), task("c", 1, 900)],
    };
    const html = renderLayer([lane], rowWindow(0, 0), () => true);
    expect(handles(html, "a")).toEqual(["start", "end"]);
    expect(handles(html, "b")).toEqual(["start crowded", "end"]);
    expect(handles(html, "c")).toEqual(["start", "end"]);
  });

  it("lifts the bar under the mouse above its lane neighbour, so its finish dot stays reachable", () => {
    const lane = { id: "a+b", depth: 0, tasks: [task("a", 1, 666, 54), task("b", 1, 720)] };
    const html = renderLayer([lane], rowWindow(0, 0), () => true, (store) =>
      store.getState().setHoveredTaskId("a")
    );
    const classes = (id: string) =>
      html.split(`data-task-id="${id}"`)[1].match(/class="([^"]*)"/)?.[1] ?? "";

    expect(classes("a")).toContain(" hovered");
    expect(classes("b")).not.toContain(" hovered");
    expect(
      rules(".gantt-bar-wrap:has(> .gantt-task-bar.hovered)").some((body) =>
        /z-index:\s*[1-9]/.test(body)
      )
    ).toBe(true);
  });

  it("arms a crowded handle only under the pointer, never by selection or on touch", () => {
    const disarmed = (body: string) =>
      /opacity:\s*0;/.test(body) && /pointer-events:\s*none;/.test(body);
    expect(
      rules(".gantt-task-bar.selected:not(:hover) .gantt-link-handle.crowded").some(disarmed)
    ).toBe(true);
    const touch = css.slice(css.indexOf("@media (hover: none) {"));
    expect(
      rules(".gantt-task-bar .gantt-link-handle.crowded", touch.slice(0, touch.indexOf("\n}\n"))).some(
        disarmed
      )
    ).toBe(true);
  });
});
