import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Nothing at runtime ties the readout's top/height to the header row heights - these assertions do
const css = readFileSync("src/styles.css", "utf8");
const guides = readFileSync("src/bars/components/GanttDragGuides.tsx", "utf8");
const gantt = readFileSync("src/Gantt.tsx", "utf8");

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

  it("mounts inside the header wrapper, not over the grid", () => {
    const wrapper = gantt.indexOf('className="gantt-header-wrapper"');
    expect(wrapper).toBeGreaterThan(-1);
    const mount = gantt.indexOf("<GanttDragGuides");
    expect(mount).toBeGreaterThan(wrapper);
    // ...and before the content layer starts, i.e. still inside the header wrapper
    expect(mount).toBeLessThan(gantt.indexOf("gantt-content", wrapper));
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

  // The footprint is the one shape on the axis: a tint of the foreground, no edge, no accent
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
    expect(css).not.toContain("--gantt-drag-band");
    // Cell-anchored, so nothing pins and nothing is measured
    expect(block(".gantt-drag-cell")).not.toContain("sticky");
    expect(guides).not.toContain("useRef");
    expect(guides).not.toContain("useLayoutEffect");
  });
});

describe("drag readout writes the cell the moving edge lands in", () => {
  it("finds each edge's cell off the cells' own widths", () => {
    expect(guides).toContain("tickBoundaries(bottomRowCells)");
    expect(guides).toContain("tickCellAt(boundaries, startX)");
    expect(guides).toContain("tickCellAt(boundaries, endX)");
  });

  it("labels each end on its own, not one merged string", () => {
    expect(guides).toContain("edge(offset.offsetStartDate)");
    expect(guides).toContain("edge(offset.offsetEndDate)");
  });

  it("writes both ends for a move and only the dragged one for a resize", () => {
    expect(guides).toContain('dragMode === "left"');
    expect(guides).toContain('dragMode === "right"');
  });

  it("writes one range label when both ends land in the same cell", () => {
    expect(guides).toContain("startCell.index === endCell.index");
    expect(guides).toContain(
      "range(offset.offsetStartDate, offset.offsetEndDate)"
    );
  });

  it("paints the footprint after the cells, so it reaches the bar's pixel edge", () => {
    expect(guides.indexOf("gantt-drag-footprint")).toBeGreaterThan(
      guides.indexOf("gantt-drag-cell")
    );
  });
});
