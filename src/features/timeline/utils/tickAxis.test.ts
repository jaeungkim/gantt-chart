import { describe, expect, it } from 'vitest';
import { tickAxis, tickCellAt } from './tickAxis';

const cells = (...widths: number[]) =>
  widths.map((widthPx) => ({ startDate: null as never, widthPx }));

describe('the cell a value falls in', () => {
  const axis = tickAxis(cells(72, 72, 72, 72));

  it('returns the cell as an index, its left edge and its width', () => {
    expect(tickCellAt(axis, 100)).toEqual({ index: 1, left: 72, width: 72 });
    expect(tickCellAt(axis, 73)).toEqual({ index: 1, left: 72, width: 72 });
    expect(tickCellAt(axis, 143)).toEqual({ index: 1, left: 72, width: 72 });
  });

  it('gives a value on a boundary to the cell that starts there', () => {
    expect(tickCellAt(axis, 144)).toEqual({ index: 2, left: 144, width: 72 });
    expect(tickCellAt(axis, 0)).toEqual({ index: 0, left: 0, width: 72 });
  });

  it('clamps to the first and last cell rather than running off the ruler', () => {
    expect(tickCellAt(axis, -40)).toEqual({ index: 0, left: 0, width: 72 });
    expect(tickCellAt(axis, 288)).toEqual({ index: 3, left: 216, width: 72 });
    expect(tickCellAt(axis, 9999)).toEqual({ index: 3, left: 216, width: 72 });
  });

  it('handles cells of unequal width', () => {
    expect(tickCellAt(tickAxis(cells(30, 126, 126)), 100)).toEqual({
      index: 1,
      left: 30,
      width: 126,
    });
  });

  it('has no cell to return on an empty ruler, which is what an empty chart gives it', () => {
    expect(tickCellAt(tickAxis([]), 500)).toBeNull();
  });
});
