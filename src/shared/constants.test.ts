import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import dayjs from "core/dates";
import {
  DATE_FORMATS,
  EDGE_THRESHOLD,
  GANTT_SCALE_CONFIG,
  PROGRESS_HANDLE_INSET,
} from "./constants";

// The dots are children of the bar, so one covering the resize grip steals its pointer. That
// geometry is split across styles.css and this file, so check it against the shipped stylesheet.
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

// First `prop: <number>px` inside the given selector's block
function px(selector: string, prop: string): number {
  const block = css.split(selector)[1]?.split("}")[0];
  if (!block) throw new Error(`no block for ${selector}`);
  const match = block.match(new RegExp(`${prop}:\\s*(-?[\\d.]+)px`));
  if (!match) throw new Error(`no ${prop} in ${selector}`);
  return Number(match[1]);
}

describe("bar-end hit areas", () => {
  it("keeps the connector dot's hit pad off the resize grip", () => {
    const dotWidth = px(".gantt-link-handle {", "width");
    const dotLeft = px(".gantt-link-handle.start {", "left");
    // inset is top/right/bottom/left; the right value reaches back toward the bar edge at x = 0.
    const padRight = Number(
      css
        .split(".gantt-link-handle.start::before {")[1]
        .split("}")[0]
        .match(/inset:\s*-?[\d.]+px\s+(-?[\d.]+)px/)![1]
    );

    expect(dotLeft + dotWidth + Math.abs(padRight)).toBeLessThanOrEqual(0);
  });

  it("keeps the progress dot off the resize grip at 0%", () => {
    const handleWidth = px(".gantt-progress-handle {", "width");
    const handleOffset = px(".gantt-progress-handle {", "margin-left");

    // GanttBar clamps the handle's `left` to PROGRESS_HANDLE_INSET, the nearest it gets to the start.
    expect(PROGRESS_HANDLE_INSET + handleOffset).toBeGreaterThanOrEqual(
      EDGE_THRESHOLD
    );
    // ...and off the end grip
    expect(handleWidth + handleOffset).toBeLessThanOrEqual(
      PROGRESS_HANDLE_INSET - EDGE_THRESHOLD
    );
  });
});

describe('GANTT_SCALE_CONFIG labels', () => {
  const afternoon = dayjs('2025-09-01T15:00');

  it('labels day ticks in 24-hour time so AM and PM differ', () => {
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T09:00'))).toBe('09');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(afternoon)).toBe('15');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T00:00'))).toBe('00');
  });

  it('labels year-scale month ticks with the month, not the day of month', () => {
    expect(GANTT_SCALE_CONFIG.year.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(GANTT_SCALE_CONFIG.week.formatTickLabel?.(afternoon)).toBe('1');
  });

  it('labels month ticks with the month, since a cell is a week and not a day', () => {
    expect(GANTT_SCALE_CONFIG.month.formatTickLabel?.(afternoon)).toBe('Sep 1');
  });

  it('labels quarter ticks with the month and the group with the quarter', () => {
    expect(GANTT_SCALE_CONFIG.quarter.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(
      ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].map((d) =>
        GANTT_SCALE_CONFIG.quarter.formatHeaderLabel?.(dayjs(d)),
      ),
    ).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']);
  });

  it('shows the year in every header label and drag tooltip format', () => {
    expect(GANTT_SCALE_CONFIG.day.formatHeaderLabel?.(afternoon)).toBe('Sep 1, 2025');
    expect(GANTT_SCALE_CONFIG.week.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.month.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.year.formatHeaderLabel?.(afternoon)).toBe('2025');
    expect(afternoon.format(DATE_FORMATS.day)).toBe('Sep 1, 2025 15:00 UTC');
    expect(afternoon.format(DATE_FORMATS.week)).toBe('Sep 1, 2025');

    expect(afternoon.format(DATE_FORMATS.quarter)).toBe('Sep 2025');
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
