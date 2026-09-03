import { describe, expect, it } from 'vitest';
import { snapDown, snapUp, tickBoundaries } from './header';

// The drag readout masks the tick numerals it stands in for. A numeral is centred in its cell, so
// a mask edge landing anywhere inside a cell would clip that numeral mid-glyph - these are what
// round the mask out to whole cells.
const cells = (...widths: number[]) =>
  widths.map((widthPx) => ({ startDate: null as never, widthPx }));

describe('tick boundaries', () => {
  it('walks the cells into cumulative edges, starting at the origin', () => {
    expect(tickBoundaries(cells(72, 72, 72, 72))).toEqual([0, 72, 144, 216, 288]);
  });

  it('gives an empty ruler a single origin, so a snap still has something to return', () => {
    expect(tickBoundaries([])).toEqual([0]);
  });

  // An edge month can be one cell wide, so the cells are not all the same width
  it('handles cells of unequal width', () => {
    expect(tickBoundaries(cells(30, 126, 126))).toEqual([0, 30, 156, 282]);
  });
});

describe('snapping to a tick boundary', () => {
  const boundaries = [0, 72, 144, 216, 288];

  it('leaves a value already on a boundary where it is', () => {
    expect(snapDown(boundaries, 144)).toBe(144);
    expect(snapUp(boundaries, 144)).toBe(144);
  });

  it('opens outward to the cell the value falls in', () => {
    expect(snapDown(boundaries, 100)).toBe(72);
    expect(snapUp(boundaries, 100)).toBe(144);
    expect(snapDown(boundaries, 73)).toBe(72);
    expect(snapUp(boundaries, 143)).toBe(144);
  });

  it('clamps rather than running off either end of the ruler', () => {
    expect(snapDown(boundaries, -40)).toBe(0);
    expect(snapUp(boundaries, -40)).toBe(0);
    expect(snapDown(boundaries, 9999)).toBe(288);
    expect(snapUp(boundaries, 9999)).toBe(288);
  });

  it('never returns a down-snap above its up-snap, whatever the value', () => {
    for (let x = -10; x <= 300; x += 7) {
      expect(snapDown(boundaries, x)).toBeLessThanOrEqual(snapUp(boundaries, x));
    }
  });

  it('is safe on a one-boundary ruler, which is what an empty chart gives it', () => {
    expect(snapDown([0], 500)).toBe(0);
    expect(snapUp([0], 500)).toBe(0);
  });
});
