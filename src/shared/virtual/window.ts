import type { VirtualAxis } from 'shared/virtual/axis';

// At or below this count the axis returns its whole range.
export const MIN_VIRTUAL_COUNT = 24;

// Items kept beyond each edge so a scroll lands on already-mounted content.
export const OVERSCAN = 5;

export interface VirtualWindow {
  /** First index to render */
  start: number;
  /** Last index to render, inclusive - `-1` when the axis is empty */
  end: number;
}

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export type ScrollDirection = -1 | 0 | 1;

export function fullWindow(count: number): VirtualWindow {
  return { start: 0, end: count - 1 };
}

export function windowOf(
  axis: VirtualAxis,
  scroll: number,
  viewport: number,
  overscan = OVERSCAN,
  direction: ScrollDirection = 0,
): VirtualWindow {
  if (
    axis.count <= MIN_VIRTUAL_COUNT ||
    viewport <= 0 ||
    axis.total <= viewport
  ) {
    return fullWindow(axis.count);
  }

  // Overscan doubles toward the edge about to be exposed.
  const before = overscan + (direction < 0 ? overscan : 0);
  const after = overscan + (direction > 0 ? overscan : 0);

  const head = Math.max(0, scroll);
  const start = Math.max(0, axis.indexAt(head) - before);
  const end = Math.min(axis.count - 1, axis.indexAt(head + viewport) + after);

  return { start, end };
}

export function virtualItemsOf(
  axis: VirtualAxis,
  window: VirtualWindow,
): VirtualItem[] {
  const items: VirtualItem[] = [];
  for (let index = window.start; index <= window.end; index += 1) {
    items.push({ index, start: axis.offsetAt(index), size: axis.sizeAt(index) });
  }
  return items;
}

// What culling compares against.
export function windowBounds(
  axis: VirtualAxis,
  window: VirtualWindow,
): { startPx: number; endPx: number } {
  return {
    startPx: axis.offsetAt(window.start),
    endPx: axis.offsetAt(window.end + 1),
  };
}

export function sameWindow(a: VirtualWindow, b: VirtualWindow): boolean {
  return a.start === b.start && a.end === b.end;
}
