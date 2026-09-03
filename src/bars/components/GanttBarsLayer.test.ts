import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAR_HEIGHT, NODE_HEIGHT } from "shared/constants";

// .gantt-bar-wrap takes the z-index lift for the open tooltip, so its whole subtree sorts with it
const layer = readFileSync("src/bars/components/GanttBarsLayer.tsx", "utf8");
const bar = readFileSync("src/bars/components/GanttBar.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

describe("bar wrapper stacking", () => {
  it("keeps the class the lift rules select", () => {
    expect(layer).toContain('className="gantt-bar-wrap"');
    expect(css).toContain(
      ".gantt-bar-wrap:has(> .gantt-task-bar.has-tooltip)"
    );
    expect(css).toContain(".gantt-bar-wrap:has(> .gantt-task-bar.dragging)");
  });

  it("carries no unmanaged stacking trigger", () => {
    const wrapper = layer.slice(
      layer.indexOf('className="gantt-bar-wrap"'),
      layer.indexOf("<GanttBar")
    );
    expect(wrapper).not.toMatch(/opacity|filter|willChange|contain|isolation/);
  });

  it("drives the lift off tooltipReason, not CSS :hover", () => {
    // The pointer leaves the bar during a progress drag while the readout is still up
    expect(bar).toContain('tooltipReason ? " has-tooltip" : ""');
  });
});

describe("baseline strip", () => {
  it("fits in the clearance below the bar", () => {
    // The wrapper is NODE_HEIGHT - 1 tall with the bar centred, so that is all the room the strip has
    const start = css.indexOf(".gantt-baseline {");
    const rule = css.slice(start, css.indexOf("}", start));
    const bottom = Number(/bottom:\s*([\d.]+)px/.exec(rule)?.[1]);
    const height = Number(/height:\s*([\d.]+)px/.exec(rule)?.[1]);

    expect(bottom + height).toBeLessThanOrEqual(
      (NODE_HEIGHT - 1 - BAR_HEIGHT) / 2
    );
  });

  it("clamps a point baseline to a width that can be seen", () => {
    // baselineStart with no baselineEnd measures 1px
    expect(layer).toContain(
      "Math.max(task.baselineWidth ?? 0, MIN_BAR_WIDTH)"
    );
  });
});

describe("bar geometry has one source of truth", () => {
  it("leaves the draw ghost's height to BAR_HEIGHT", () => {
    const ghost = css.slice(
      css.indexOf(".gantt-draw-ghost {"),
      css.indexOf("}", css.indexOf(".gantt-draw-ghost {"))
    );
    expect(ghost).not.toMatch(/height:\s*\d+px/);
    expect(ghost).not.toMatch(/margin-top:\s*\d+px/);
  });
});
