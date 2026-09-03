import type { VirtualAxis } from 'shared/virtual/axis';

// Below this count the axis reports itself unvirtualized and returns its whole range.
export const MIN_VIRTUAL_COUNT = 24;

export interface VirtualWindow {
  /** First index to render */
  start: number;
  /** Last index to render, inclusive - `-1` when the axis is empty */
  end: number;
  /** Pixels before `start` */
  padStart: number;
  /** Pixels after `end` */
  padEnd: number;
  /** False when the whole axis is being rendered */
  virtualized: boolean;
}

export interface VirtualItem {
  index: number;
  key: number;
  start: number;
  end: number;
  size: number;
}

export type ScrollDirection = -1 | 0 | 1;

export function fullWindow(count: number): VirtualWindow {
  return {
    start: 0,
    end: count - 1,
    padStart: 0,
    padEnd: 0,
    virtualized: false,
  };
}

// The slice of an axis worth rendering; falls back to the whole axis when content
// already fits, the viewport is unmeasured, or there are too few items.
export function windowOf(
  axis: VirtualAxis,
  scroll: number,
  viewport: number,
  overscan = 5,
  direction: ScrollDirection = 0,
): VirtualWindow {
  if (
    axis.count === 0 ||
    axis.count <= MIN_VIRTUAL_COUNT ||
    viewport <= 0 ||
    axis.total <= viewport
  ) {
    return fullWindow(axis.count);
  }

  // Overscan doubles in the direction of travel - the edge about to be exposed.
  const before = overscan + (direction < 0 ? overscan : 0);
  const after = overscan + (direction > 0 ? overscan : 0);

  const head = Math.max(0, scroll);
  const start = Math.max(0, axis.indexAt(head) - before);
  const end = Math.min(axis.count - 1, axis.indexAt(head + viewport) + after);

  return {
    start,
    end,
    padStart: axis.offsetAt(start),
    padEnd: Math.max(0, axis.total - axis.offsetAt(end + 1)),
    virtualized: true,
  };
}

// Materializes a window into positioned items.
export function virtualItemsOf(
  axis: VirtualAxis,
  window: VirtualWindow,
): VirtualItem[] {
  const items: VirtualItem[] = [];
  for (let index = window.start; index <= window.end; index += 1) {
    const start = axis.offsetAt(index);
    const size = axis.sizeAt(index);
    items.push({ index, key: index, start, end: start + size, size });
  }
  return items;
}

// Pixel bounds of a window - what horizontal culling compares against.
export function windowBounds(
  axis: VirtualAxis,
  window: VirtualWindow,
): { startPx: number; endPx: number } {
  if (window.end < window.start) return { startPx: 0, endPx: 0 };
  return {
    startPx: axis.offsetAt(window.start),
    endPx: axis.offsetAt(window.end + 1),
  };
}

export function sameWindow(a: VirtualWindow, b: VirtualWindow): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.virtualized === b.virtualized &&
    a.padStart === b.padStart &&
    a.padEnd === b.padEnd
  );
}
