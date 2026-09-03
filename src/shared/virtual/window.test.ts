import { describe, expect, it } from 'vitest';
import { fixedAxis, variableAxis } from './axis';
import type { VirtualAxis } from './axis';
import {
  MIN_VIRTUAL_COUNT,
  virtualItemsOf,
  windowBounds,
  windowOf,
} from './window';
import type { VirtualWindow } from './window';

// size of everything the window says to render
const renderedPx = (axis: VirtualAxis, window: VirtualWindow) => {
  let total = 0;
  for (let i = window.start; i <= window.end; i += 1) total += axis.sizeAt(i);
  return total;
};

describe('windowOf - when it declines to virtualize', () => {
  it('renders everything below the item threshold', () => {
    const axis = fixedAxis(MIN_VIRTUAL_COUNT, 38);
    const window = windowOf(axis, 0, 100);

    expect(window.virtualized).toBe(false);
    expect([window.start, window.end]).toEqual([0, MIN_VIRTUAL_COUNT - 1]);
    expect([window.padStart, window.padEnd]).toEqual([0, 0]);
  });

  it('renders everything when the content already fits', () => {
    expect(windowOf(fixedAxis(100, 10), 0, 5000).virtualized).toBe(false);
  });

  it('renders everything before the viewport has been measured', () => {
    // the container mounts at height 0 - culling against that would blank the chart
    expect(windowOf(fixedAxis(100, 10), 0, 0).virtualized).toBe(false);
  });

  it('reports an empty axis as an empty range', () => {
    expect(windowOf(fixedAxis(0, 38), 0, 100).end).toBe(-1);
  });
});

describe('windowOf - the window it computes', () => {
  const axis = fixedAxis(1000, 38);
  const overscan = 5;

  it('covers the viewport plus overscan on both sides', () => {
    const window = windowOf(axis, 3800, 760, overscan);

    expect(window.virtualized).toBe(true);
    expect(window.start).toBe(100 - overscan);
    expect(window.end).toBe(120 + overscan);
  });

  it('accounts for every pixel of the axis', () => {
    const window = windowOf(axis, 3800, 760, overscan);

    expect(window.padStart + renderedPx(axis, window) + window.padEnd).toBe(
      axis.total,
    );
  });

  it('accounts for every pixel on an axis of mixed sizes', () => {
    const axis = variableAxis(500, (index) => 20 + (index % 7) * 5);

    for (const scroll of [0, 137, 1000, axis.total - 300, axis.total]) {
      const window = windowOf(axis, scroll, 300, 4);
      expect(
        Math.round(window.padStart + renderedPx(axis, window) + window.padEnd),
      ).toBe(Math.round(axis.total));
    }
  });

  it('spends its overscan in the direction of travel', () => {
    const still = windowOf(axis, 3800, 760, overscan, 0);
    const forward = windowOf(axis, 3800, 760, overscan, 1);
    const backward = windowOf(axis, 3800, 760, overscan, -1);

    expect(forward.end).toBeGreaterThan(still.end);
    expect(forward.start).toBe(still.start);
    expect(backward.start).toBeLessThan(still.start);
    expect(backward.end).toBe(still.end);
  });

  it('has no padding to give at either end', () => {
    const top = windowOf(axis, 0, 760, overscan);
    expect(top.start).toBe(0);
    expect(top.padStart).toBe(0);

    const bottom = windowOf(axis, axis.total - 760, 760, overscan);
    expect(bottom.end).toBe(axis.count - 1);
    expect(bottom.padEnd).toBe(0);
  });

  it('treats a negative scroll position as the top', () => {
    // overscroll bounce reports one, and it must not read as the far end of the axis
    expect(windowOf(axis, -200, 760, overscan).start).toBe(0);
  });
});

describe('virtualItemsOf', () => {
  const axis = variableAxis(100, (index) => (index % 2 === 0 ? 30 : 50));

  it('positions each item where the axis puts it', () => {
    const window = windowOf(axis, 400, 200, 2);
    const items = virtualItemsOf(axis, window);

    expect(items).toHaveLength(window.end - window.start + 1);
    expect(items[0].index).toBe(window.start);
    expect(items[0].start).toBe(window.padStart);

    for (const item of items) {
      expect(item.start).toBe(axis.offsetAt(item.index));
      expect(item.size).toBe(axis.sizeAt(item.index));
      expect(item.end).toBe(item.start + item.size);
    }
  });

  it('yields nothing for an empty axis', () => {
    const empty = fixedAxis(0, 38);
    expect(virtualItemsOf(empty, windowOf(empty, 0, 100))).toEqual([]);
  });
});

describe('windowBounds - what horizontal culling compares against', () => {
  const axis = fixedAxis(1000, 32);

  it('spans from the first rendered cell to the end of the last', () => {
    const window = windowOf(axis, 3200, 640, 5);
    const { startPx, endPx } = windowBounds(axis, window);

    expect(startPx).toBe(axis.offsetAt(window.start));
    expect(endPx).toBe(axis.offsetAt(window.end + 1));

    // a bar overlapping the edge is still on screen; one wholly outside is not
    const overlapsStart = (left: number, width: number) =>
      left + width >= startPx && left <= endPx;
    expect(overlapsStart(startPx - 10, 20)).toBe(true);
    expect(overlapsStart(startPx - 100, 20)).toBe(false);
    expect(overlapsStart(endPx - 5, 500)).toBe(true);
    expect(overlapsStart(endPx + 5, 500)).toBe(false);
  });

  it('is empty for an empty axis', () => {
    const empty = fixedAxis(0, 32);
    expect(windowBounds(empty, windowOf(empty, 0, 100))).toEqual({
      startPx: 0,
      endPx: 0,
    });
  });
});
