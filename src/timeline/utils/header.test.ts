import { describe, expect, it } from 'vitest';
import { tickBoundaries, tickCellAt } from './header';

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

describe('the cell a value falls in', () => {
  const boundaries = tickBoundaries(cells(72, 72, 72, 72));

  it('returns the cell as an index, its left edge and its width', () => {
    expect(tickCellAt(boundaries, 100)).toEqual({ index: 1, left: 72, width: 72 });
    expect(tickCellAt(boundaries, 73)).toEqual({ index: 1, left: 72, width: 72 });
    expect(tickCellAt(boundaries, 143)).toEqual({ index: 1, left: 72, width: 72 });
  });

  // The tick at a boundary marks the instant that cell starts, so an edge exactly there belongs
  // to that cell - a bar ending at midnight writes the day it ends on, not the day before
  it('gives a value on a boundary to the cell that starts there', () => {
    expect(tickCellAt(boundaries, 144)).toEqual({ index: 2, left: 144, width: 72 });
    expect(tickCellAt(boundaries, 0)).toEqual({ index: 0, left: 0, width: 72 });
  });

  it('clamps to the first and last cell rather than running off the ruler', () => {
    expect(tickCellAt(boundaries, -40)).toEqual({ index: 0, left: 0, width: 72 });
    expect(tickCellAt(boundaries, 288)).toEqual({ index: 3, left: 216, width: 72 });
    expect(tickCellAt(boundaries, 9999)).toEqual({ index: 3, left: 216, width: 72 });
  });

  it('handles cells of unequal width', () => {
    expect(tickCellAt(tickBoundaries(cells(30, 126, 126)), 100)).toEqual({
      index: 1,
      left: 30,
      width: 126,
    });
  });

  it('has no cell to return on an empty ruler, which is what an empty chart gives it', () => {
    expect(tickCellAt([0], 500)).toBeNull();
  });
});
