import { describe, expect, it } from 'vitest';
import type { Dayjs } from 'dayjs';
import dayjs from 'core/dates';
import type { Task } from 'shared/task';
import { mergeHeaderGroups } from './header';
import {
  calculateDateOffsetPx,
  calculateDateOffsets,
  computeNonWorkingRanges,
  computeTimelineData,
  createTopHeaderGroups,
  originShiftPx,
  snapDrawnRange,
} from './geometry';
import { transformTasks } from './transform';

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

const group = (label: string, widthPx: number) => ({
  label,
  widthPx,
  startDate: dayjs('2025-01-01'),
});

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

describe('calculateDateOffsetPx', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('offsets whole and partial ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2025-01-01'), t, 'week')).toBe(0);
    expect(calculateDateOffsetPx(dayjs('2025-01-02'), t, 'week')).toBe(TICK);
    expect(calculateDateOffsetPx(dayjs('2025-01-02T12:00'), t, 'week')).toBe(TICK * 1.5);
  });

  it('returns null outside the timeline range and for no ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2024-12-31'), t, 'week')).toBeNull();
    expect(calculateDateOffsetPx(dayjs('2025-01-04'), t, 'week')).toBeNull();
    expect(calculateDateOffsetPx(dayjs(), [], 'week')).toBeNull();
  });
});

describe('computeNonWorkingRanges', () => {
  // 2025-01-01 is a Wednesday; Jan 4 (Sat) and Jan 5 (Sun) are the weekend.
  const week = ticks(
    '2025-01-01',
    '2025-01-02',
    '2025-01-03',
    '2025-01-04',
    '2025-01-05',
    '2025-01-06',
    '2025-01-07',
  );
  const isWeekend = (d: ReturnType<typeof dayjs>) => d.day() === 0 || d.day() === 6;

  it('merges adjacent weekend ticks into one range', () => {
    expect(computeNonWorkingRanges(week, 'week', isWeekend)).toEqual([
      { left: TICK * 3, width: TICK * 2 },
    ]);
  });

  it('keeps non-adjacent ranges separate', () => {
    const withHoliday = (d: ReturnType<typeof dayjs>) =>
      isWeekend(d) || d.format('YYYY-MM-DD') === '2025-01-07';
    expect(computeNonWorkingRanges(week, 'week', withHoliday)).toEqual([
      { left: TICK * 3, width: TICK * 2 },
      { left: TICK * 6, width: TICK },
    ]);
  });

  it('returns nothing for scales coarser than a day', () => {
    expect(computeNonWorkingRanges(week, 'year', isWeekend)).toEqual([]);
    expect(computeNonWorkingRanges([], 'week', isWeekend)).toEqual([]);
  });
});

describe('createTopHeaderGroups', () => {
  it('groups daily ticks into month headers', () => {
    expect(
      createTopHeaderGroups(ticks('2025-01-30', '2025-01-31', '2025-02-01'), 'week'),
    ).toMatchObject([
      { label: 'Jan 2025', widthPx: TICK * 2 },
      { label: 'Feb 2025', widthPx: TICK },
    ]);
    expect(createTopHeaderGroups([], 'week')).toEqual([]);
  });

  it('groups monthly ticks into year headers at year scale', () => {
    expect(
      createTopHeaderGroups(ticks('2025-11-01', '2025-12-01', '2026-01-01'), 'year'),
    ).toMatchObject([
      { label: '2025', widthPx: TICK * 2 },
      { label: '2026', widthPx: TICK },
    ]);
  });

  it('groups sub-day ticks into day headers at day scale', () => {
    expect(
      createTopHeaderGroups(
        ticks('2025-09-01T12:00', '2025-09-01T18:00', '2025-09-02T00:00'),
        'day',
      ),
    ).toMatchObject([
      { label: 'Sep 1, 2025', widthPx: TICK * 2 },
      { label: 'Sep 2, 2025', widthPx: TICK },
    ]);
  });

  it('groups monthly ticks into quarter headers at quarter scale', () => {
    expect(
      createTopHeaderGroups(
        ticks('2025-02-01', '2025-03-01', '2025-04-01', '2025-07-01'),
        'quarter',
      ),
    ).toMatchObject([
      { label: 'Q1 2025', widthPx: TICK * 2 },
      { label: 'Q2 2025', widthPx: TICK },
      { label: 'Q3 2025', widthPx: TICK },
    ]);
  });
});

describe('mergeHeaderGroups', () => {
  it('merges adjacent equal labels without mutating input', () => {
    const input = [group('Jan', 10), group('Jan', 20), group('Feb', 5)];
    expect(mergeHeaderGroups(input)).toMatchObject([
      { label: 'Jan', widthPx: 30 },
      { label: 'Feb', widthPx: 5 },
    ]);
    expect(input[0].widthPx).toBe(10);
  });
});

describe('computeTimelineData', () => {
  it('pads the range by 5 ticks on each side and positions bars', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-01-10', '2025-01-12')],
      'week',
    );
    expect(bottomCells).toHaveLength(12); // 2025-01-05 .. 2025-01-16
    expect(transformedTasks[0]).toMatchObject({ barLeft: 360, barWidth: 144 }); // 5*72, 2*72
    expect(computeTimelineData([], 'week')).toEqual({ bottomCells: [], transformedTasks: [] });
  });

  it('builds 72px quarter-day cells at day scale', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-01-10T09:00', '2025-01-10T12:00')],
      'day',
    );

    // 09:00 - 30h .. 12:00 + 30h, one cell every six hours
    expect(bottomCells[0].startDate.toISOString()).toBe('2025-01-09T00:00:00.000Z');
    expect(new Set(bottomCells.map((c) => c.widthPx))).toEqual(new Set([72]));
    // 33h from the origin at 12px an hour, 3h long
    expect(transformedTasks[0]).toMatchObject({ barLeft: 396, barWidth: 36 });
  });

  it('builds month cells sized by real month length at quarter scale', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-02-10', '2025-03-10')],
      'quarter',
    );

    // 2024-09 .. 2025-08, one cell a month, 4px a day
    expect(bottomCells).toHaveLength(12);
    expect(bottomCells[0].startDate.toISOString()).toBe('2024-09-01T00:00:00.000Z');
    expect(
      new Map(bottomCells.map((c) => [c.startDate.format('YYYY-MM'), c.widthPx])).get(
        '2025-02',
      ),
    ).toBe(28 * 4);
    expect(transformedTasks[0]).toMatchObject({ barLeft: 648, barWidth: 112 }); // 28 days
  });
});

describe('snapDrawnRange', () => {
  const iso = (range: { startDate: Dayjs; endDate: Dayjs } | null) =>
    range && [range.startDate.format(), range.endDate.format()];

  it('snaps outwards to the day ticks the drag covered (one day a tick)', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05');
    // inside the second tick, and inside the fourth
    expect(iso(snapDrawnRange(TICK + 8, TICK * 3 + 8, t, 'week'))).toEqual([
      dayjs('2025-01-02').format(),
      dayjs('2025-01-05').format(),
    ]);
  });

  it('gives a one-tick task when the drag stays inside a single tick', () => {
    const t = ticks('2025-01-01', '2025-01-02');
    expect(iso(snapDrawnRange(4, 20, t, 'week'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-01-02').format(),
    ]);
  });

  it('reads a right-to-left drag the same way', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');
    expect(iso(snapDrawnRange(90, 10, t, 'week'))).toEqual(
      iso(snapDrawnRange(10, 90, t, 'week')),
    );
  });

  it('snaps to whole six-hour cells on the day scale (72px a cell)', () => {
    const t = ['2025-01-01T00:00', '2025-01-01T06:00', '2025-01-01T12:00'].map((d) => ({
      startDate: dayjs(d),
      widthPx: 72,
    }));
    expect(iso(snapDrawnRange(10, 80, t, 'day'))).toEqual([
      dayjs('2025-01-01T00:00').format(),
      dayjs('2025-01-01T12:00').format(),
    ]);
  });

  it('snaps to the whole six-hour cell on the day scale', () => {
    const t = ['2025-01-01T00:00', '2025-01-01T06:00'].map((d) => ({
      startDate: dayjs(d),
      widthPx: 72,
    }));
    expect(iso(snapDrawnRange(0, 5, t, 'day'))).toEqual([
      dayjs('2025-01-01T00:00').format(),
      dayjs('2025-01-01T06:00').format(),
    ]);
  });

  it('snaps to whole months on the quarter scale (4px a day)', () => {
    const t = [
      { startDate: dayjs('2025-01-01'), widthPx: 31 * 4 },
      { startDate: dayjs('2025-02-01'), widthPx: 28 * 4 },
      { startDate: dayjs('2025-03-01'), widthPx: 31 * 4 },
    ];
    expect(iso(snapDrawnRange(10, 130, t, 'quarter'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-03-01').format(),
    ]);
  });

  it('clamps a drag that runs past either end of the timeline', () => {
    const t = ticks('2025-01-01', '2025-01-02');
    expect(iso(snapDrawnRange(-500, 9999, t, 'week'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-01-03').format(),
    ]);
  });

  it('reports the snapped box so the ghost bar covers whole ticks', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04');
    expect(snapDrawnRange(TICK + 8, TICK * 2 + 8, t, 'week')).toMatchObject({
      leftPx: TICK,
      widthPx: TICK * 2,
    });
  });

  it('returns null without a timeline', () => {
    expect(snapDrawnRange(0, 100, [], 'week')).toBeNull();
  });
});

describe('originShiftPx', () => {
  const prev = ticks('2025-01-05', '2025-01-06', '2025-01-07');

  it('returns how far the origin moved when cells are prepended', () => {
    const next = ticks('2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07');
    expect(originShiftPx(prev, next, 'week')).toBe(TICK * 2); // two cells added in front
  });

  it('returns a negative shift when leading cells disappear', () => {
    const next = ticks('2025-01-07', '2025-01-08');
    expect(originShiftPx(prev, next, 'week')).toBe(TICK * -2);
  });

  it('is zero when the origin is unchanged or a timeline is empty', () => {
    expect(originShiftPx(prev, ticks('2025-01-05', '2025-01-06'), 'week')).toBe(0);
    expect(originShiftPx([], prev, 'week')).toBe(0);
    expect(originShiftPx(prev, [], 'week')).toBe(0);
  });
});
