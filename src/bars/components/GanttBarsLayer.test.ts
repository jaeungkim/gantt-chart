import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAR_HEIGHT, SUMMARY_BAR_HEIGHT } from "shared/constants";

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

describe("bar geometry has one source of truth", () => {
  it("leaves the draw ghost's height to BAR_HEIGHT", () => {
    const ghost = css.slice(
      css.indexOf(".gantt-draw-ghost {"),
      css.indexOf("}", css.indexOf(".gantt-draw-ghost {"))
    );
    expect(ghost).not.toMatch(/height:\s*\d+px/);
    expect(ghost).not.toMatch(/margin-top:\s*\d+px/);
  });

  it("says roll-up with height, and leaves the fill free to be recolored", () => {
    // The only cue left after the end caps went; a `color` on a parent repaints the fill
    expect(SUMMARY_BAR_HEIGHT).toBeLessThan(BAR_HEIGHT);
    expect(bar).toContain(
      "currentTask.isSummary ? SUMMARY_BAR_HEIGHT : BAR_HEIGHT"
    );
    const summary = css.slice(
      css.indexOf(".gantt-task-bar.summary {"),
      css.indexOf("}", css.indexOf(".gantt-task-bar.summary {"))
    );
    expect(summary).not.toMatch(/height:/);
  });
});
