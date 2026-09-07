import { describe, expect, it } from 'vitest';
import dayjs from 'core/dates';
import type { Task } from 'shared/task';
import { calculateDateOffsets, transformTasks } from './transform';

// week scale: every tick is one day, 72px; coarser-scale tests reuse it as a uniform width.
// Bare dates parse as local midnight on both sides, so assertions are timezone-independent.
const TICK = 72;
const ticks = (...days: string[]) => days.map((d) => ({ startDate: dayjs(d), widthPx: TICK }));

const task = (
  id: string,
  sequence: string,
  startDate = '2025-01-02',
  endDate = '2025-01-03',
): Task => ({ id, name: id, startDate, endDate, parentId: null, sequence });

describe('transformTasks', () => {
  it('sorts by numeric sequence (1.10 after 1.2) and derives depth/order', () => {
    const out = transformTasks(
      [task('b', '1.10'), task('a', '1.2'), task('c', '2')],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'week',
    );
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((t) => t.depth)).toEqual([1, 1, 0]);
    expect(out.map((t) => t.order)).toEqual([1, 2, 3]);
  });
});

describe('calculateDateOffsets', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('skips ticks before the task and spans whole ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-03'), t, 'week')).toEqual({
      barMarginLeftAmount: TICK,
      barWidthSize: TICK,
    });
  });

  it('handles a task starting mid-tick', () => {
    expect(
      calculateDateOffsets(dayjs('2025-01-02T12:00'), dayjs('2025-01-03'), t, 'week'),
    ).toEqual({ barMarginLeftAmount: TICK * 1.5, barWidthSize: TICK / 2 });
  });

  it('clamps zero-duration to 1px and returns zeros for no ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-02'), t, 'week')).toEqual({
      barMarginLeftAmount: TICK,
      barWidthSize: 1,
    });
    expect(calculateDateOffsets(dayjs(), dayjs(), [], 'week')).toEqual({
      barMarginLeftAmount: 0,
      barWidthSize: 0,
    });
  });
});
