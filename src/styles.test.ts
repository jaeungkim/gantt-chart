import { describe, expect, it } from "vitest";
import { stylesheet } from "shared/utils/stylesheet.test-utils";

const css = stylesheet;

function declaration(selector: string, property: string): string | undefined {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} not found in styles.css`).toBeGreaterThan(-1);
  return css
    .slice(start, css.indexOf("}", start))
    .match(new RegExp(`[{;]\\s*${property}:\\s*([^;]+);`))?.[1]
    .trim();
}

const zIndex = (selector: string) => Number(declaration(selector, "z-index"));

describe("stacking inside the timeline", () => {
  it("keeps the link menu under the sticky header, as the arrow it opened from is", () => {
    expect(zIndex(".gantt-link-menu")).toBeLessThan(zIndex(".gantt-header-wrapper"));
    expect(zIndex(".gantt-link-menu")).toBeGreaterThan(zIndex(".gantt-link-preview-label"));
  });
});

describe("header hover targets", () => {
  it("hovers a holiday by its own band, never by the tick-wide label cell it reveals", () => {
    expect(declaration(".gantt-holiday-band", "pointer-events")).toBe("auto");
    expect(declaration(".gantt-holiday-cell", "pointer-events")).toBe("none");
  });
});

describe("timeline hit targets", () => {
  it("lets a click beside a bar reach the empty timeline: the wrap spans x 0 to the bar's width", () => {
    expect(declaration(".gantt-bar-wrap", "left")).toBe("0");
    expect(declaration(".gantt-bar-wrap", "pointer-events")).toBe("none");
    expect(declaration(".gantt-task-bar", "pointer-events")).toBe("auto");
  });
});
