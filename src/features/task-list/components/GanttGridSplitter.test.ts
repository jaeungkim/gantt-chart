import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID_WIDTH } from "shared/constants";
import GanttGridSplitter from "./GanttGridSplitter";

const CHART_WIDTH = 600;
const main = { clientWidth: CHART_WIDTH };

interface SplitterProps {
  style: { left: string };
  onPointerDown: (event: unknown) => void;
  onDoubleClick: (event: unknown) => void;
}

const render = (width: number, onWidthChange: (width: number) => void = () => {}) =>
  (GanttGridSplitter({ width, onWidthChange }) as unknown as { props: SplitterProps }).props;

let doc: EventTarget & { createRange?: () => unknown };

beforeEach(() => {
  doc = new EventTarget();
  vi.stubGlobal("document", doc);
});
afterEach(() => vi.unstubAllGlobals());

function drag(width: number, fromX: number, toX: number): number {
  const widths: number[] = [];
  render(width, (next) => widths.push(next)).onPointerDown({
    isPrimary: true,
    button: 0,
    pointerId: 1,
    clientX: fromX,
    currentTarget: { setPointerCapture: () => {}, parentElement: main },
  });
  for (const type of ["pointermove", "pointerup"]) {
    doc.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, clientX: toX }));
  }
  return widths.at(-1)!;
}

describe("splitter stays inside the chart", () => {
  it("stops a drag released past the right edge short of it", () => {
    const width = drag(DEFAULT_GRID_WIDTH, DEFAULT_GRID_WIDTH, 1000);
    expect(width).toBeLessThan(CHART_WIDTH - 5);
  });

  it("stops a fit to a long task name short of the right edge", () => {
    doc.createRange = () => ({
      selectNodeContents: () => {},
      getBoundingClientRect: () => ({ width: 575 }),
    });
    const row = { getBoundingClientRect: () => ({ left: 0 }) };
    const text = {
      closest: () => row,
      getBoundingClientRect: () => ({ left: 30 }),
      nextElementSibling: null,
    };
    const grid = { getBoundingClientRect: () => ({ width: 220 }), offsetWidth: 220 };
    const widths: number[] = [];
    render(DEFAULT_GRID_WIDTH, (next) => widths.push(next)).onDoubleClick({
      currentTarget: {
        parentElement: { ...main, querySelectorAll: () => [text], querySelector: () => grid },
      },
    });

    expect(widths.at(-1)).toBeLessThan(CHART_WIDTH - 5);
  });

  it("draws the handle inside the chart even when the chart narrowed under a wide pane", () => {
    expect(render(800).style.left).toMatch(/^min\(798px, 100% - \d+px\)$/);
  });

  it("starts a drag on that handle from where it is drawn", () => {
    const drawnAt = drag(800, 0, 0);
    expect(drawnAt).toBeLessThan(CHART_WIDTH - 5);
    expect(drag(800, 500, 490)).toBe(drawnAt - 10);
  });
});
