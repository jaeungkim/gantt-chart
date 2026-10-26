import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import dayjs from "core/dates";
import { GANTT_SCALE_CONFIG, LINK_HANDLE_REACH, resolveGeometry } from "./constants";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function px(selector: string, prop: string): number {
  const block = css.split(selector)[1]?.split("}")[0];
  if (!block) throw new Error(`no block for ${selector}`);
  const match = block.match(new RegExp(`${prop}:\\s*(-?[\\d.]+)px`));
  if (!match) throw new Error(`no ${prop} in ${selector}`);
  return Number(match[1]);
}

describe("bar-end hit areas", () => {
  const dotWidth = px(".gantt-link-handle {", "width");
  const dotHeight = px(".gantt-link-handle {", "height");
  const dotBorder = px(".gantt-link-handle {", "border");

  function declared(selector: string, prop: string): string {
    const block = css.split(selector)[1]?.split("}")[0];
    const value = block?.match(new RegExp(`(?:^|\\s)${prop}:\\s*([^;]+);`))?.[1].trim();
    if (!value) throw new Error(`no ${prop} in ${selector}`);
    return value;
  }

  // How far the pad reaches past the dot's border box, [top, right, bottom, left], on a bar this tall
  function padReach(side: "start" | "end", barHeight = resolveGeometry().barHeight): number[] {
    // The pad is positioned against the dot's padding box, so its % are of that box
    const paddingBox = dotHeight - 2 * dotBorder;
    const inset = (value: string) => {
      const calc = value.match(/^calc\(([\d.]+)% - var\(--gantt-bar-height\) \/ 2\)$/);
      return calc ? (Number(calc[1]) / 100) * paddingBox - barHeight / 2 : parseFloat(value);
    };
    return [
      declared(".gantt-link-handle::before {", "top"),
      declared(`.gantt-link-handle.${side}::before {`, "right"),
      declared(".gantt-link-handle::before {", "bottom"),
      declared(`.gantt-link-handle.${side}::before {`, "left"),
    ].map((value) => -inset(value) - dotBorder);
  }

  it("butts the connector dot's hit pad against the bar edge", () => {
    const startGap = -px(".gantt-link-handle.start {", "left") - dotWidth - padReach("start")[1];
    const endGap = -px(".gantt-link-handle.end {", "right") - dotWidth - padReach("end")[3];

    expect(startGap).toBe(0);
    expect(endGap).toBe(0);
  });

  it("tells lane bars how far a handle's hit pad reaches past the bar's end", () => {
    expect(-px(".gantt-link-handle.start {", "left") + padReach("start")[3]).toBe(LINK_HANDLE_REACH);
    expect(-px(".gantt-link-handle.end {", "right") + padReach("end")[1]).toBe(LINK_HANDLE_REACH);
  });

  it("spans the bar's full height with the dot's hit pad, at any bar height", () => {
    const tall = resolveGeometry(48, 40);
    for (const barHeight of [resolveGeometry().barHeight, tall.barHeight, tall.summaryBarHeight]) {
      for (const side of ["start", "end"] as const) {
        const [top, , bottom] = padReach(side, barHeight);
        expect(dotHeight + top + bottom, `${side} pad, ${barHeight}px bar`).toBeGreaterThanOrEqual(
          barHeight
        );
      }
    }
  });
});

describe("resolveGeometry", () => {
  it("keeps today's geometry when nothing is set", () => {
    expect(resolveGeometry()).toEqual({
      rowHeight: 38,
      barHeight: 28,
      summaryBarHeight: 18,
    });
  });

  it("falls back to the default for anything but a positive finite number", () => {
    for (const bad of [NaN, Infinity, -Infinity, 0, -12, "40" as unknown as number]) {
      expect(resolveGeometry(bad, bad)).toEqual(resolveGeometry());
    }
  });

  it("scales the default bar with the row", () => {
    expect(resolveGeometry(28).barHeight).toBe(21);
    expect(resolveGeometry(76).barHeight).toBe(56);
  });

  it("caps the bar 4px under the row, never under 1px, so bars in adjacent rows never touch", () => {
    expect(resolveGeometry(28, 28)).toMatchObject({ rowHeight: 28, barHeight: 24 });
    expect(resolveGeometry(undefined, 50).barHeight).toBe(34);
    expect(resolveGeometry(3).barHeight).toBe(1);
  });

  it("keeps the summary bar's share of the bar, never under 1px", () => {
    expect(resolveGeometry(60, 56).summaryBarHeight).toBe(36);
    expect(resolveGeometry(undefined, 0.5).summaryBarHeight).toBe(1);
  });
});

describe('GANTT_SCALE_CONFIG labels', () => {
  const afternoon = dayjs('2025-09-01T15:00');

  it('labels day ticks in 24-hour time so AM and PM differ', () => {
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T09:00'))).toBe('09');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(afternoon)).toBe('15');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T00:00'))).toBe('00');
  });

  it('labels quarter ticks with the month and the group with the quarter', () => {
    expect(GANTT_SCALE_CONFIG.quarter.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(
      ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].map((d) =>
        GANTT_SCALE_CONFIG.quarter.formatHeaderLabel?.(dayjs(d)),
      ),
    ).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']);
  });

  it('lists the scales finest first, so the selector reads as a zoom ladder', () => {
    expect(Object.keys(GANTT_SCALE_CONFIG)).toEqual([
      'day',
      'week',
      'month',
      'quarter',
      'year',
    ]);
  });
});
