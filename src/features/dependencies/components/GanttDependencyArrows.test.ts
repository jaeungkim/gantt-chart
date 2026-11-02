// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GanttVirtualization } from "features/timeline/types";
import { resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { TaskTransformed } from "shared/task";
import { pointer } from "shared/testing/dom";
import GanttDependencyArrows from "./GanttDependencyArrows";

const bar = (
  id: string,
  order: number,
  barLeft: number,
  dependencies?: TaskTransformed["dependencies"]
): TaskTransformed => ({
  id,
  name: id,
  sequence: `${order}`,
  parentId: null,
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-06T00:00:00.000Z",
  barLeft,
  barWidth: 90,
  depth: 0,
  order,
  originalOrder: order,
  dependencies,
});

const virtual = {
  totalHeight: 200,
  totalWidth: 2000,
  rowStartPx: 0,
  rowEndPx: 200,
  isBarVisible: () => true,
} as unknown as GanttVirtualization;

const LINKED = [bar("a", 1, 100), bar("b", 2, 300, [{ targetId: "a", type: "FS" }])];

const roots: Root[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => roots.splice(0).forEach((root) => root.unmount()));
  document.body.innerHTML = "";
});

const mountChart = async (parent: Node = document.body) => {
  const container = parent.appendChild(document.createElement("div"));
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      createElement(
        GanttStoreContext.Provider,
        { value: createGanttStore("month") },
        createElement(GanttDependencyArrows, {
          transformedTasks: LINKED,
          virtual,
          geometry: resolveGeometry(),
        })
      )
    )
  );
  const query = <T extends Element>(selector: string) => {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`no ${selector}`);
    return found;
  };
  return {
    container,
    selectLink: () => pointer("pointerdown", query(".gantt-dependency-hit"), 50, 50),
    isSelected: () =>
      container.querySelector("path.gantt-dependency-arrow.selected") !== null,
    menu: () => container.querySelector<HTMLElement>(".gantt-link-menu"),
    deleteButton: () => query<HTMLButtonElement>(".gantt-link-menu-delete"),
    arrows: () => query<SVGSVGElement>("svg.gantt-dependency-arrows"),
  };
};

const shadowHost = (mode: ShadowRootMode) => {
  const host = document.body.appendChild(document.createElement("div"));
  return host.attachShadow({ mode });
};

const shadowRootsAround = (target: EventTarget | null) => {
  const found = new Set<ShadowRoot>();
  let root = target instanceof Node ? target.getRootNode() : null;
  while (root instanceof ShadowRoot) {
    found.add(root);
    root = root.host.getRootNode();
  }
  return found;
};

const hideClosedShadowTreesFromOutsideListeners = () => {
  const composedPath = Event.prototype.composedPath;
  vi.spyOn(Event.prototype, "composedPath").mockImplementation(function (this: Event) {
    const path = composedPath.call(this);
    if (!this.currentTarget) return path;
    const visible = shadowRootsAround(this.currentTarget);
    return path.filter((node) =>
        [...shadowRootsAround(node)].every((root) => root.mode === "open" || visible.has(root))
      );
  });
};

const pressOn = (target: EventTarget) => pointer("pointerdown", target, 5, 5);

describe("clearing the selected link", () => {
  it("selects a link and opens its menu when its arrow is pressed", async () => {
    const chart = await mountChart();
    await chart.selectLink();

    expect(chart.isSelected()).toBe(true);
    expect(chart.menu()).not.toBeNull();
  });

  it("clears the selection and closes the menu on a press elsewhere on the page", async () => {
    const chart = await mountChart();
    const elsewhere = document.body.appendChild(document.createElement("div"));
    await chart.selectLink();

    await pressOn(elsewhere);

    expect(chart.isSelected()).toBe(false);
    expect(chart.menu()).toBeNull();
  });

  it("clears the selection when a press lands on a second chart that stops the event", async () => {
    const first = await mountChart();
    const second = await mountChart();
    await first.selectLink();

    await second.selectLink();

    expect(first.isSelected()).toBe(false);
    expect(second.isSelected()).toBe(true);
  });

  it("keeps the selection on a press on this chart's own arrows or link menu", async () => {
    const chart = await mountChart();
    await chart.selectLink();

    await pressOn(chart.arrows());
    await pressOn(chart.menu()!);
    await pressOn(chart.deleteButton());

    expect(chart.isSelected()).toBe(true);
    expect(chart.menu()).not.toBeNull();
  });

  it("clears the selection on a press inside a shadow root elsewhere on the page", async () => {
    const chart = await mountChart();
    const inside = shadowHost("closed").appendChild(document.createElement("div"));
    await chart.selectLink();

    await pressOn(inside);

    expect(chart.isSelected()).toBe(false);
  });

  it("hides a closed shadow root's nodes from listeners outside it, as a browser does", async () => {
    hideClosedShadowTreesFromOutsideListeners();
    const inside = shadowHost("closed").appendChild(document.createElement("span"));
    let seen: EventTarget[] = [];
    document.addEventListener("pointerdown", (event) => (seen = event.composedPath()), {
      capture: true,
      once: true,
    });

    await pressOn(inside);

    expect(seen).not.toContain(inside);
    expect(seen).toContain(document.body);
  });

  for (const mode of ["open", "closed"] as const) {
    describe(`inside a ${mode} shadow root`, () => {
      if (mode === "closed") beforeEach(hideClosedShadowTreesFromOutsideListeners);

      it("keeps the selection on a press on this chart's own arrows or link menu", async () => {
        const chart = await mountChart(shadowHost(mode));
        await chart.selectLink();

        await pressOn(chart.arrows());
        await pressOn(chart.deleteButton());

        expect(chart.isSelected()).toBe(true);
        expect(chart.menu()).not.toBeNull();
      });

      it("clears the selection on a press elsewhere inside the same shadow root", async () => {
        const shadow = shadowHost(mode);
        const chart = await mountChart(shadow);
        const sibling = shadow.appendChild(document.createElement("div"));
        await chart.selectLink();

        await pressOn(sibling);

        expect(chart.isSelected()).toBe(false);
      });

      it("clears the selection on a press outside the shadow host", async () => {
        const chart = await mountChart(shadowHost(mode));
        const outside = document.body.appendChild(document.createElement("div"));
        await chart.selectLink();

        await pressOn(outside);

        expect(chart.isSelected()).toBe(false);
        expect(chart.menu()).toBeNull();
      });
    });
  }
});

describe("two entries for one pair of tasks", () => {
  it("paints both arrows while the pair is selected, as the pair is what a press selects", () => {
    const tasks = [
      bar("a", 1, 100),
      bar("b", 2, 300, [
        { targetId: "a", type: "FS" },
        { targetId: "a", type: "SS" },
      ]),
    ];
    const store = createGanttStore("month");
    store.getInitialState = store.getState;
    store.getState().setSelectedDependency({ sourceId: "b", targetId: "a" });

    const html = renderToStaticMarkup(
      createElement(
        GanttStoreContext.Provider,
        { value: store },
        createElement(GanttDependencyArrows, {
          transformedTasks: tasks,
          virtual,
          geometry: resolveGeometry(),
        })
      )
    );

    expect(html.match(/class="gantt-dependency-arrow selected/g)).toHaveLength(2);
  });
});
