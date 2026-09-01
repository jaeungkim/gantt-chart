import { describe, expect, it } from 'vitest';
import dayjs from 'core/dates';
import {
  resolveCanvasScale,
  resolveExportRangePx,
  toSvgDataUrl,
} from './pngExport';

// month scale: tickUnit day, unitPerTick 1, basePxPerDragStep 32 -> every tick is exactly 32px
const ticks = (...days: string[]) =>
  days.map((d) => ({ startDate: dayjs(d), widthPx: 32 }));

// 3 days, 96px wide
const cells = ticks('2025-01-01', '2025-01-02', '2025-01-03');
const TOTAL_WIDTH = 96;

describe('resolveCanvasScale', () => {
  it('keeps the requested ratio when the canvas fits', () => {
    expect(resolveCanvasScale(800, 600, 2)).toBe(2);
  });

  it('clamps so neither side exceeds the maximum', () => {
    // 5000 * 2 = 10000 > 8000, so the scale drops to exactly 8000/5000
    expect(resolveCanvasScale(5000, 100, 2, 8000, 1e12)).toBeCloseTo(1.6);
    expect(resolveCanvasScale(100, 5000, 2, 8000, 1e12)).toBeCloseTo(1.6);
  });

  it('clamps on total area as well as on each side', () => {
    // 400 * 400 = 160_000 px; at scale 2 that is 640_000 > 250_000
    expect(resolveCanvasScale(400, 400, 2, 1e6, 250_000)).toBeCloseTo(1.25);
  });

  it('goes below 1 for a chart wider than a canvas can be', () => {
    expect(resolveCanvasScale(40_000, 500, 2, 16_384, 1e12)).toBeLessThan(1);
  });

  it('falls back to 1 for a nonsensical pixel ratio', () => {
    expect(resolveCanvasScale(800, 600, 0)).toBe(1);
    expect(resolveCanvasScale(800, 600, -3)).toBe(1);
    expect(resolveCanvasScale(800, 600, Number.NaN)).toBe(1);
  });
});

describe('resolveExportRangePx', () => {
  it('covers the whole timeline when no range is given', () => {
    expect(resolveExportRangePx(undefined, cells, 'month', TOTAL_WIDTH)).toEqual({
      left: 0,
      width: TOTAL_WIDTH,
    });
  });

  it('clips to the requested range', () => {
    expect(
      resolveExportRangePx(
        { from: '2025-01-02', to: '2025-01-03' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toEqual({ left: 32, width: 32 });
  });

  it('accepts the range in either order', () => {
    expect(
      resolveExportRangePx(
        { from: '2025-01-03', to: '2025-01-02' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toEqual({ left: 32, width: 32 });
  });

  it('clamps a start before the timeline to its left edge', () => {
    expect(
      resolveExportRangePx(
        { from: '2020-01-01', to: '2025-01-02' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toEqual({ left: 0, width: 32 });
  });

  it('clamps an end past the timeline to its right edge', () => {
    expect(
      resolveExportRangePx(
        { from: '2025-01-02', to: '2030-01-01' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toEqual({ left: 32, width: 64 });
  });

  it('throws when the range misses the timeline entirely', () => {
    expect(() =>
      resolveExportRangePx(
        { from: '2020-01-01', to: '2020-06-01' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toThrow(/does not overlap/);

    expect(() =>
      resolveExportRangePx(
        { from: '2030-01-01', to: '2030-06-01' },
        cells,
        'month',
        TOTAL_WIDTH,
      ),
    ).toThrow(/does not overlap/);
  });

  it('falls back to the full width when there is no timeline', () => {
    expect(
      resolveExportRangePx({ from: '2025-01-01', to: '2025-01-02' }, [], 'month', 0),
    ).toEqual({ left: 0, width: 0 });
  });
});

describe('toSvgDataUrl', () => {
  it('wraps the markup in a sized foreignObject', () => {
    const decoded = decodeURIComponent(
      toSvgDataUrl('<div xmlns="http://www.w3.org/1999/xhtml">hi</div>', 300, 200).replace(
        'data:image/svg+xml;charset=utf-8,',
        '',
      ),
    );

    expect(decoded).toContain('width="300" height="200"');
    expect(decoded).toContain('viewBox="0 0 300 200"');
    expect(decoded).toContain('<foreignObject x="0" y="0" width="300" height="200">');
    expect(decoded).toContain('>hi</div>');
  });

  it('percent-encodes characters a data URL cannot carry raw', () => {
    const url = toSvgDataUrl('<p xmlns="http://www.w3.org/1999/xhtml">진행 #1</p>', 10, 10);

    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(url).not.toContain('#');
    expect(decodeURIComponent(url)).toContain('진행 #1');
  });
});
