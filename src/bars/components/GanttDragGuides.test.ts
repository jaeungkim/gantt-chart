import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Nothing at runtime ties .gantt-drag-range's top/height to the header row heights - these assertions do
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
  it("starts the span exactly below the top header row", () => {
    expect(declaration(".gantt-drag-range", "top")).toBe(
      declaration(".gantt-top-header", "height")
    );
  });

  it("makes the span exactly as tall as the tick row", () => {
    expect(declaration(".gantt-drag-range", "height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });

  it("fills the tick row's height with a label, so it occludes cleanly", () => {
    expect(declaration(".gantt-drag-edge", "line-height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });
});

describe("drag readout replaces the guide lines", () => {
  it("draws no full-height guide rule any more", () => {
    expect(css).not.toContain(".gantt-drag-guide {");
    expect(guides).not.toContain('gantt-drag-guide"');
  });

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

describe("drag readout is the tick row, not a panel on it", () => {
  it("draws no band, ring, shadow or accent behind the span", () => {
    const range = block(".gantt-drag-range");
    expect(range).not.toContain("background");
    expect(range).not.toContain("box-shadow");
    expect(range).not.toContain("border");
  });

  it("gives a label the tick row's own surface, so it blanks only what it covers", () => {
    expect(declaration(".gantt-drag-edge", "background")).toBe(
      declaration(".gantt-bottom-row", "background")
    );
    expect(block(".gantt-drag-edge")).not.toContain("box-shadow");
    expect(block(".gantt-drag-edge")).not.toContain("border-radius");
  });

  it("types a label exactly like the tick beside it", () => {
    for (const property of ["font-size", "font-weight", "letter-spacing"]) {
      expect(declaration(".gantt-drag-edge", property)).toBe(
        declaration(".gantt-bottom-cell", property)
      );
    }
  });

  it("never lifts a label into the month row - the span grows instead", () => {
    expect(css).not.toContain(".gantt-drag-guide-label");
    expect(declaration(".gantt-drag-range", "min-width")).toBe("max-content");
    // No lift means nothing to measure, so the component keeps no ref and runs no layout effect
    expect(guides).not.toContain("useRef");
    expect(guides).not.toContain("useLayoutEffect");
  });
});

describe("drag readout reports the edge the gesture moves", () => {
  it("labels each end on its own, not one merged string", () => {
    expect(guides).toContain("edge(offset.offsetStartDate)");
    expect(guides).toContain("edge(offset.offsetEndDate)");
  });

  it("writes both ends for a move and only the dragged one for a resize", () => {
    expect(guides).toContain('dragMode === "left"');
    expect(guides).toContain('dragMode === "right"');
    // the move branch is the one that lists both sides
    expect(guides).toMatch(/side: "start".*\n?.*side: "end"/s);
  });

  it("collapses to one merged label when both ends read alike", () => {
    expect(guides).toContain("startLabel === endLabel");
    expect(guides).toContain('side: "start end"');
  });

  // A span is routinely wider than the scrollport - day scale draws 288px per calendar day - so
  // an unpinned label would sit off-screen for the whole gesture
  it("pins each label to the side it reports", () => {
    expect(declaration(".gantt-drag-edge.start", "position")).toBe("sticky");
    expect(declaration(".gantt-drag-edge.start", "left")).toMatch(
      /var\(--gantt-pane-inset/
    );
    expect(declaration(".gantt-drag-edge.end", "position")).toBe("sticky");
    expect(declaration(".gantt-drag-edge.end", "right")).toBe("0");
  });

  // Two labels pinned to opposite sides of the same box slide into each other once the visible
  // slice of the span is narrower than they are; a half per label is what stops that
  it("bounds each label's travel to its own half of the span", () => {
    expect(guides).toContain("gantt-drag-side");
    expect(declaration(".gantt-drag-side", "min-width")).toBe("max-content");
    expect(declaration(".gantt-drag-side.start", "justify-content")).toBe(
      "flex-start"
    );
    expect(declaration(".gantt-drag-side.end", "justify-content")).toBe(
      "flex-end"
    );
  });
});

// A tick numeral is centred in its cell, so a mask edge landing anywhere inside a cell clips that
// numeral mid-glyph. Snapping the mask out to whole cells is what keeps the ruler readable.
describe("drag readout never slices a tick numeral", () => {
  it("masks the covered numerals with the tick row's own colour, not a tint", () => {
    expect(declaration(".gantt-drag-mask", "background")).toBe(
      declaration(".gantt-bottom-row", "background")
    );
    const mask = block(".gantt-drag-mask");
    expect(mask).not.toContain("border");
    expect(mask).not.toContain("box-shadow");
    expect(mask).not.toContain("opacity");
  });

  it("lines the mask up with the tick row it stands in for", () => {
    expect(declaration(".gantt-drag-mask", "top")).toBe(
      declaration(".gantt-top-header", "height")
    );
    expect(declaration(".gantt-drag-mask", "height")).toBe(
      declaration(".gantt-bottom-row", "height")
    );
  });

  it("snaps the mask out to whole cells, off the cells' own widths", () => {
    expect(guides).toContain("snapDown(boundaries, startX)");
    expect(guides).toContain("snapUp(boundaries, endX)");
    expect(guides).toContain("tickBoundaries(bottomRowCells)");
  });

  // The band token was the last thing painting a colour of its own on the axis
  it("leaves no band token behind for a container override to reach", () => {
    expect(css).not.toContain("--gantt-drag-band");
  });
});
