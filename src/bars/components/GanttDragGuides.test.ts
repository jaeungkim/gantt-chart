import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Nothing at runtime ties .gantt-drag-range's top/height to the header row heights - these assertions do
const css = readFileSync("src/styles.css", "utf8");
const guides = readFileSync("src/bars/components/GanttDragGuides.tsx", "utf8");
const gantt = readFileSync("src/Gantt.tsx", "utf8");

function declaration(selector: string, property: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} not found in styles.css`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  const match = block.match(new RegExp(`(?:^|[;{]\\s*)${property}:\\s*([^;]+)`, "m"));
  expect(match, `${property} not found in ${selector}`).not.toBeNull();
  return match![1].trim();
}

describe("drag readout geometry", () => {
  it("starts the band exactly below the top header row", () => {
    expect(declaration(".gantt-drag-range", "top")).toBe(
      declaration(".gantt-top-header", "height")
    );
  });

  it("makes the band exactly as tall as the tick row", () => {
    expect(declaration(".gantt-drag-range", "height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });
});

describe("drag readout replaces the guide lines", () => {
  it("draws no full-height guide rule any more", () => {
    expect(css).not.toContain(".gantt-drag-guide {");
    expect(guides).not.toContain("gantt-drag-guide\"");
  });

  it("needs no stacking rung, because it rides the header wrapper's", () => {
    const start = css.indexOf(".gantt-drag-guides {");
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf("}", start))).not.toContain("z-index");
  });

  it("mounts inside the header wrapper, not over the grid", () => {
    const wrapper = gantt.indexOf('className="gantt-header-wrapper"');
    expect(wrapper).toBeGreaterThan(-1);
    const mount = gantt.indexOf("<GanttDragGuides");
    expect(mount).toBeGreaterThan(wrapper);
    // ...and before the content layer starts, i.e. still inside the header wrapper
    expect(mount).toBeLessThan(gantt.indexOf("gantt-content", wrapper));
  });

  it("reports one range, not one label per edge", () => {
    expect(guides).toContain("gantt-drag-range");
    expect(guides.match(/gantt-drag-guide-label/g)).toHaveLength(1);
  });
});
