import localDayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { GANTT_SCALE_CONFIG } from 'shared/constants';
import type { GanttScaleKey } from 'shared/types';
import type { Task } from 'shared/task';
import dayjs from 'core/dates';
import { computeTimelineData, shiftByDragSteps } from './geometry';

// Swaps the process time zone for the duration of fn; Node applies TZ to Date math at once.
function withTimeZone<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

const task = (startDate: string, endDate: string): Task => ({
  id: 'a',
  name: 'a',
  startDate,
  endDate,
  parentId: null,
  sequence: '1',
});

const widths = (t: Task, scale: GanttScaleKey) =>
  computeTimelineData([t], scale).bottomCells.map((c) => c.widthPx);

// America/New_York: 2025-03-09 is 23 hours (spring DST), 2025-11-02 is 25 hours (fall DST)
const SPRING_FORWARD = task('2025-03-08T00:00:00Z', '2025-03-10T00:00:00Z');
const FALL_BACK = task('2025-11-01T00:00:00Z', '2025-11-03T00:00:00Z');

describe('timeline cells across DST boundaries (#28)', () => {
  it('keeps day cell widths uniform through a spring DST week', () => {
    withTimeZone('America/New_York', () => {
      expect(new Set(widths(SPRING_FORWARD, 'week'))).toEqual(new Set([72]));
    });
  });

  it('keeps sub-day cell widths uniform through a spring DST day', () => {
    // The grid is UTC, so every cell is six hours even where the local day is 23 hours
    withTimeZone('America/New_York', () => {
      expect(new Set(widths(SPRING_FORWARD, 'day'))).toEqual(new Set([72]));
    });
  });

  it('keeps day cell widths uniform through a fall DST week', () => {
    withTimeZone('America/New_York', () => {
      expect(new Set(widths(FALL_BACK, 'week'))).toEqual(new Set([72]));
    });
  });

  it('sizes quarter-scale month cells by the real calendar month length', () => {
    // quarter: dragStepUnit 'day' with 7 days, basePxPerDragStep 28 -> 4px per day
    withTimeZone('America/New_York', () => {
      const cells = computeTimelineData(
        [task('2025-02-01T00:00:00Z', '2025-07-01T00:00:00Z')],
        'quarter',
      ).bottomCells;
      const byMonth = new Map(
        cells.map((c) => [c.startDate.format('YYYY-MM'), c.widthPx]),
      );
      expect(byMonth.get('2025-02')).toBe(28 * 4);
      expect(byMonth.get('2025-03')).toBe(31 * 4); // has DST
      expect(byMonth.get('2025-04')).toBe(30 * 4);
      expect(byMonth.get('2025-11')).toBe(30 * 4); // has DST
    });
  });
});

describe('shiftByDragSteps (#28)', () => {
  it('adds calendar units, so the time of day survives a spring DST crossing', () => {
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-03-08T23:30');
      expect(shiftByDragSteps(start, 1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-09 23:30',
      );
      expect(shiftByDragSteps(start, 2, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-10 23:30',
      );
      expect(shiftByDragSteps(start, -1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-07 23:30',
      );
    });
  });

  it('adds calendar units, so the time of day survives a fall DST crossing', () => {
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-11-01T23:30');
      expect(shiftByDragSteps(start, 1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-11-02 23:30',
      );
    });
  });

  it('moves exactly 7 days per step at quarter scale, even across DST', () => {
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-03-05T09:00');
      expect(shiftByDragSteps(start, 1, 'quarter').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-12 09:00',
      );
    });
  });

  it('takes the drag step for each scale straight from the config', () => {
    const base = dayjs('2025-01-01T00:00:00Z');
    expect(shiftByDragSteps(base, 3, 'day').toISOString()).toBe('2025-01-01T03:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'week').toISOString()).toBe('2025-01-01T18:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'month').toISOString()).toBe('2025-01-04T00:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'quarter').toISOString()).toBe('2025-01-22T00:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'year').toISOString()).toBe('2025-03-26T00:00:00.000Z');
    // Converting a month-scale step into a fixed 30 days would not match the real month length
    expect(shiftByDragSteps(dayjs('2025-01-31T00:00:00Z'), 30, 'month').toISOString()).toBe(
      '2025-03-02T00:00:00.000Z',
    );
  });
});

describe('UTC-based positioning (#84)', () => {
  const boundary = task('2025-03-10T23:00:00Z', '2025-03-11T05:00:00Z');

  it('draws the same data at the same position whatever the viewer time zone', () => {
    const seoul = withTimeZone('Asia/Seoul', () => computeTimelineData([boundary], 'month'));
    const london = withTimeZone('Europe/London', () =>
      computeTimelineData([boundary], 'month'),
    );

    expect(seoul.transformedTasks[0].barLeft).toBe(london.transformedTasks[0].barLeft);
    expect(seoul.transformedTasks[0].barWidth).toBe(london.transformedTasks[0].barWidth);
    expect(seoul.bottomCells.map((c) => c.startDate.toISOString())).toEqual(
      london.bottomCells.map((c) => c.startDate.toISOString()),
    );
  });

  it('sticks a task on a UTC date boundary to the UTC calendar cell', () => {
    // Starts 3/10 23:00Z -> 23/24 of the way into the "Mar 10" cell
    const { bottomCells, transformedTasks } = withTimeZone('Asia/Seoul', () =>
      computeTimelineData([boundary], 'week'),
    );
    const index = bottomCells.findIndex(
      (c) => c.startDate.format('YYYY-MM-DD') === '2025-03-10',
    );

    expect(index).toBeGreaterThanOrEqual(0);
    expect(transformedTasks[0].barLeft).toBeCloseTo(index * 72 + (72 * 23) / 24, 5);
    expect(transformedTasks[0].barWidth).toBeCloseTo((72 * 6) / 24, 5);
  });

  it('uses UTC calendar dates for cell labels and headers', () => {
    const { bottomCells } = withTimeZone('Asia/Seoul', () =>
      computeTimelineData([task('2025-06-01T00:00:00Z', '2025-06-02T00:00:00Z')], 'week'),
    );
    const labels = bottomCells.map((c) => GANTT_SCALE_CONFIG.week.formatTickLabel?.(c.startDate));

    // The first cell is 5/27, five ticks before 6/1
    expect(bottomCells[0].startDate.toISOString()).toBe('2025-05-27T00:00:00.000Z');
    expect(labels.slice(0, 6)).toEqual(['27', '28', '29', '30', '31', '1']);
  });

  it('reads a zone-less string as a UTC wall clock and shows it exactly as written', () => {
    withTimeZone('Asia/Seoul', () => {
      expect(dayjs('2025-06-01T09:00').format('YYYY-MM-DD HH:mm')).toBe('2025-06-01 09:00');
      expect(dayjs('2025-06-01').toISOString()).toBe('2025-06-01T00:00:00.000Z');
    });
  });
});
