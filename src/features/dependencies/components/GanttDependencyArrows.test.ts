import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GanttVirtualization } from "features/timeline/types";
import { resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { TaskTransformed } from "shared/task";
import GanttDependencyArrows from "./GanttDependencyArrows";

const arrows = readFileSync(
  "src/features/dependencies/components/GanttDependencyArrows.tsx",
  "utf8"
);

const clearSelection = arrows.slice(
  arrows.indexOf("const clearSelection"),
  arrows.indexOf("const root")
);

describe("clearing the selected link", () => {
  it("hears every press on the chart's own root before another chart can stop it", () => {
    expect(arrows).toContain("arrowsRef.current?.getRootNode() ?? document");
    expect(arrows).toContain('root.addEventListener("pointerdown", clearSelection, true)');
    expect(arrows).toContain('root.removeEventListener("pointerdown", clearSelection, true)');
  });

  it("leaves a press inside a shadow host to that root, as a closed one hides × from the document", () => {
    expect(arrows).toContain("event.composedPath().includes(host)");
    expect(arrows).toContain('document.addEventListener("pointerdown", clearOutside, true)');
    expect(arrows).toContain('document.removeEventListener("pointerdown", clearOutside, true)');
  });

  it("keeps it only for this chart's own arrows and menu, even inside a shadow root", () => {
    expect(clearSelection).toContain("event.composedPath()");
    // A class match also hits every other chart's arrows and menu on the page
    expect(clearSelection).not.toContain("closest");
  });
});

describe("two entries for one pair of tasks", () => {
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

  it("paints both arrows while the pair is selected, as the pair is what a press selects", () => {
    const tasks = [
      bar("a", 1, 100),
      bar("b", 2, 300, [
        { targetId: "a", type: "FS" },
        { targetId: "a", type: "SS" },
      ]),
    ];
    const store = createGanttStore("month");
    // A server render reads the initial state, so point it at the live one
    store.getInitialState = store.getState;
    store.getState().setSelectedDependency({ sourceId: "b", targetId: "a" });
    const virtual = {
      totalHeight: 200,
      totalWidth: 2000,
      rowStartPx: 0,
      rowEndPx: 200,
      isBarVisible: () => true,
    } as unknown as GanttVirtualization;

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
