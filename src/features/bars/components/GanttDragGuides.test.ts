// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Gantt from "Gantt";
import dayjs from "core/dates";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { Task, TaskTransformed } from "shared/task";
import { pointer, render } from "shared/testing/dom";
import { stylesheet } from "shared/utils/stylesheet.test-utils";
import type { GanttDragMode } from "shared/types";
import { computeTimelineData } from "features/timeline/utils/geometry";
import GanttDragGuides from "./GanttDragGuides";

const css = stylesheet;
const tokens = readFileSync("src/tokens.css", "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} not found in styles.css`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

function declaration(selector: string, property: string): string {
  const match = block(selector).match(
    new RegExp(`(?:^|[;{]\\s*)${property}:\\s*([^;]+)`, "m")
  );
  expect(match, `${property} not found in ${selector}`).not.toBeNull();
  return match![1].trim();
}

describe("drag readout geometry", () => {
  it("lines the written cell up with the tick row it stands in for", () => {
    expect(declaration(".gantt-drag-cell", "top")).toBe(
      declaration(".gantt-top-header", "height")
    );
    expect(declaration(".gantt-drag-cell", "height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });

  it("fills the tick row's height with the date, so it occludes cleanly", () => {
    expect(declaration(".gantt-drag-cell > span", "line-height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });

  it("centres the footprint in the tick row", () => {
    const rowTop = parseInt(declaration(".gantt-top-header", "height"), 10);
    const rowHeight = parseInt(declaration(".gantt-bottom-row", "height"), 10);
    const top = parseInt(declaration(".gantt-drag-footprint", "top"), 10);
    const height = parseInt(declaration(".gantt-drag-footprint", "height"), 10);
    expect(top - rowTop).toBe((rowHeight - height) / 2);
  });

  it("gives the footprint the bar's own radius, so it reads as the bar's shadow", () => {
    expect(declaration(".gantt-drag-footprint", "border-radius")).toBe(
      declaration(".gantt-task-bar", "border-radius")
    );
  });
});

describe("drag readout mounts in the header", () => {
  it("needs no stacking rung, because it rides the header wrapper's", () => {
    expect(block(".gantt-drag-guides")).not.toContain("z-index");
  });

  it("mounts inside the header wrapper, not over the grid", async () => {
    const tasks: Task[] = [
      { id: "a", name: "A", startDate: "2025-01-01", endDate: "2025-01-05", parentId: null, sequence: "1" },
    ];
    const { host } = await render(createElement(Gantt, { tasks, onTasksChange: () => {} }));
    expect(host.querySelector(".gantt-drag-guides")).toBeNull();
    await pointer("pointerdown", host.querySelector('.gantt-task-bar[data-task-id="a"]')!, 10, 10);
    await pointer("pointermove", document, 80, 10);
    const guides = host.querySelector(".gantt-drag-guides")!;
    expect(guides).not.toBeNull();
    expect(guides.closest(".gantt-header-wrapper")).not.toBeNull();
    expect(guides.closest(".gantt-content")).toBeNull();
  });
});

describe("drag readout is the tick row being precise, not a panel on it", () => {
  it("gives the written cell the tick row's own surface, so only its numeral steps aside", () => {
    expect(declaration(".gantt-drag-cell", "background")).toBe(
      declaration(".gantt-bottom-row", "background")
    );
    expect(declaration(".gantt-drag-cell > span", "background")).toBe(
      declaration(".gantt-bottom-row", "background")
    );
    for (const selector of [".gantt-drag-cell", ".gantt-drag-cell > span"]) {
      expect(block(selector)).not.toContain("box-shadow");
      expect(block(selector)).not.toContain("border");
    }
  });

  it("centres the date in its cell, exactly like the tick it replaces", () => {
    expect(declaration(".gantt-drag-cell", "justify-content")).toBe(
      declaration(".gantt-bottom-cell", "justify-content")
    );
    for (const property of ["font-size", "font-weight", "letter-spacing"]) {
      expect(declaration(".gantt-drag-cell > span", property)).toBe(
        declaration(".gantt-bottom-cell", property)
      );
    }
  });

  it("tints the footprint from the foreground and draws no edge around it", () => {
    const background = declaration(".gantt-drag-footprint", "background");
    expect(background).toContain("color-mix(");
    expect(background).toContain("var(--gantt-foreground)");
    const footprint = block(".gantt-drag-footprint");
    expect(footprint).not.toContain("border:");
    expect(footprint).not.toContain("box-shadow");
    expect(footprint).not.toContain("--gantt-accent");
  });

  it("leaves no mask, floating label or band token behind", () => {
    for (const selector of [
      ".gantt-drag-mask",
      ".gantt-drag-range",
      ".gantt-drag-edge",
      ".gantt-drag-side",
      ".gantt-drag-guide {",
    ]) {
      expect(css).not.toContain(selector);
    }
    expect(css + tokens).not.toContain("--gantt-drag-band");
    expect(block(".gantt-drag-cell")).not.toContain("sticky");
  });
});

describe("drag readout writes the cell the moving edge lands in", () => {
  const CELL_WIDTHS = [100, 40, 200, 60];
  const cells = CELL_WIDTHS.map((widthPx, i) => ({
    startDate: dayjs("2026-03-01").add(i, "day"),
    widthPx,
  }));
  const isoDay = (date: Date) => date.toISOString().slice(0, 10);
  const localeOptions = { formats: { day: { tooltip: isoDay } } };

  const renderDrag = async (mode: GanttDragMode, barLeft: number, barWidth: number) => {
    const store = createGanttStore("day");
    store.getInitialState = store.getState;
    const pressed = {
      id: "a",
      name: "A",
      sequence: "1",
      parentId: null,
      startDate: "2026-03-02T00:00:00.000Z",
      endDate: "2026-03-03T00:00:00.000Z",
      barLeft,
      barWidth,
      depth: 0,
      order: 1,
      originalOrder: 1,
    } satisfies TaskTransformed;
    store.getState().setBottomRowCells(cells);
    store.getState().setTransformedTasks([pressed]);
    store.getState().setBarDrag({ task: pressed, mode });
    store.getState().setDragOffsets({
      a: {
        offsetX: 0,
        offsetWidth: 0,
        offsetStartDate: dayjs("2026-03-02"),
        offsetEndDate: dayjs("2026-03-03"),
      },
    });
    const { host } = await render(
      createElement(
        GanttStoreContext.Provider,
        { value: store },
        createElement(GanttDragGuides, { localeOptions })
      )
    );
    return host;
  };

  const written = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLElement>(".gantt-drag-cell")].map((cell) => ({
      left: cell.style.left,
      width: cell.style.width,
      label: cell.textContent,
    }));

  it("finds each edge's cell off the cells' own widths", async () => {
    const host = await renderDrag("bar", 110, 100);
    expect(written(host).map(({ left, width }) => ({ left, width }))).toEqual([
      { left: "100px", width: "40px" },
      { left: "140px", width: "200px" },
    ]);
  });

  it("labels each end on its own, not one merged string", async () => {
    const host = await renderDrag("bar", 110, 100);
    expect(written(host).map(({ label }) => label)).toEqual(["2026-03-02", "2026-03-03"]);
  });

  it("writes both ends for a move and only the dragged one for a resize", async () => {
    expect(written(await renderDrag("left", 110, 100))).toEqual([
      { left: "100px", width: "40px", label: "2026-03-02" },
    ]);
    expect(written(await renderDrag("right", 110, 100))).toEqual([
      { left: "140px", width: "200px", label: "2026-03-03" },
    ]);
    expect(written(await renderDrag("bar", 110, 100))).toHaveLength(2);
  });

  it("writes one range label when both ends land in the same cell", async () => {
    expect(written(await renderDrag("bar", 150, 100))).toEqual([
      { left: "140px", width: "200px", label: "2026-03-02 \u2013 2026-03-03" },
    ]);
  });

  it("paints the footprint after the cells, so it reaches the bar's pixel edge", async () => {
    const host = await renderDrag("bar", 110, 100);
    const layers = [...host.querySelector(".gantt-drag-guides")!.children].map(
      (child) => child.className
    );
    expect(layers).toEqual(["gantt-drag-cell", "gantt-drag-cell", "gantt-drag-footprint"]);
  });
});

describe("drag readout follows the bar when the timeline grows at the front mid-drag", () => {
  const tasks: Task[] = [
    {
      id: "a",
      name: "A",
      parentId: null,
      sequence: "1",
      startDate: "2026-03-20T00:00:00Z",
      endDate: "2026-03-23T00:00:00Z",
    },
  ];

  it("writes the footprint and the date cell where GanttBar draws the bar now", () => {
    const store = createGanttStore("week");
    store.getInitialState = store.getState;
    const sync = (prependedTicks: number) => {
      const data = computeTimelineData(tasks, "week", undefined, false, {
        before: prependedTicks,
        after: 0,
      });
      store.getState().setBottomRowCells(data.bottomCells);
      store.getState().setTransformedTasks(data.transformedTasks);
      return data.transformedTasks[0];
    };

    const pressed = sync(0);
    store.getState().setBarDrag({ task: pressed, mode: "bar" });
    store.getState().setDragOffsets({
      a: {
        offsetX: -144,
        offsetWidth: 0,
        offsetStartDate: dayjs(pressed.startDate).subtract(2, "day"),
        offsetEndDate: dayjs(pressed.endDate).subtract(2, "day"),
      },
    });
    const now = sync(14);
    expect(now.barLeft).toBeGreaterThan(pressed.barLeft);

    const html = renderToStaticMarkup(
      createElement(GanttStoreContext.Provider, { value: store }, createElement(GanttDragGuides))
    );
    const drawnLeft = now.barLeft - 144;
    expect(html).toContain(`class="gantt-drag-footprint" style="left:${drawnLeft}px`);
    const [, cellLeft, cellWidth] = html.match(
      /class="gantt-drag-cell" style="left:(-?[\d.]+)px;width:([\d.]+)px/
    )!.map(Number);
    expect(drawnLeft).toBeGreaterThanOrEqual(cellLeft);
    expect(drawnLeft).toBeLessThan(cellLeft + cellWidth);
  });
});
