import { describe, expect, it } from 'vitest';
import dayjs from 'utils/dayjs';
import { DATE_FORMATS, GANTT_SCALE_CONFIG } from 'constants/gantt';
import { normalizeProgress, type Task } from 'types/task';
import { getSmartGanttPath } from './arrowPath';
import { mergeHeaderGroups } from './headerUtils';
import {
  calculateDateOffsetPx,
  calculateDateOffsets,
  computeTimelineData,
  createTopHeaderGroups,
} from './timeline';
import { transformTasks } from './transformData';

// month scale: tickUnit day, unitPerTick 1, basePxPerDragStep 32 -> every tick is exactly 32px.
// Bare dates parse as local midnight on both sides, so assertions are timezone-independent.
const ticks = (...days: string[]) => days.map((d) => ({ startDate: dayjs(d), widthPx: 32 }));

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
      'month',
    );
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((t) => t.depth)).toEqual([1, 1, 0]);
    expect(out.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('positions milestones at startDate as a point, ignoring endDate', () => {
    const [m] = transformTasks(
      [{ ...task('m', '1', '2025-01-02', '2025-01-03'), type: 'milestone' as const }],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(m.barLeft).toBe(32);
    expect(m.barWidth).toBe(1);
  });
});

describe('normalizeProgress', () => {
  it('clamps to 0-100 and rejects missing or NaN values', () => {
    expect(normalizeProgress(42)).toBe(42);
    expect(normalizeProgress(-10)).toBe(0);
    expect(normalizeProgress(150)).toBe(100);
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress(Number.NaN)).toBeNull();
  });
});

describe('calculateDateOffsets', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('skips ticks before the task and spans whole ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-03'), t, 'month')).toEqual({
      barMarginLeftAmount: 32,
      barWidthSize: 32,
    });
  });

  it('handles a task starting mid-tick', () => {
    expect(
      calculateDateOffsets(dayjs('2025-01-02T12:00'), dayjs('2025-01-03'), t, 'month'),
    ).toEqual({ barMarginLeftAmount: 48, barWidthSize: 16 });
  });

  it('clamps zero-duration to 1px and returns zeros for no ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-02'), t, 'month')).toEqual({
      barMarginLeftAmount: 32,
      barWidthSize: 1,
    });
    expect(calculateDateOffsets(dayjs(), dayjs(), [], 'month')).toEqual({
      barMarginLeftAmount: 0,
      barWidthSize: 0,
    });
  });
});

describe('calculateDateOffsetPx', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('offsets whole and partial ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2025-01-01'), t, 'month')).toBe(0);
    expect(calculateDateOffsetPx(dayjs('2025-01-02'), t, 'month')).toBe(32);
    expect(calculateDateOffsetPx(dayjs('2025-01-02T12:00'), t, 'month')).toBe(48);
  });

  it('returns null outside the timeline range and for no ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2024-12-31'), t, 'month')).toBeNull();
    expect(calculateDateOffsetPx(dayjs('2025-01-04'), t, 'month')).toBeNull();
    expect(calculateDateOffsetPx(dayjs(), [], 'month')).toBeNull();
  });
});

describe('GANTT_SCALE_CONFIG labels', () => {
  const afternoon = dayjs('2025-09-01T15:00');

  it('labels day ticks in 24-hour time so AM and PM differ', () => {
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T09:00'))).toBe('09');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(afternoon)).toBe('15');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T00:00'))).toBe('00');
  });

  it('labels year-scale month ticks with the month, not the day of month', () => {
    expect(GANTT_SCALE_CONFIG.year.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(GANTT_SCALE_CONFIG.week.formatTickLabel?.(afternoon)).toBe('1');
    expect(GANTT_SCALE_CONFIG.month.formatTickLabel?.(afternoon)).toBe('1');
  });

  it('shows the year in every header label and drag tooltip format', () => {
    expect(GANTT_SCALE_CONFIG.day.formatHeaderLabel?.(afternoon)).toBe('Sep 1, 2025');
    expect(GANTT_SCALE_CONFIG.week.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.month.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.year.formatHeaderLabel?.(afternoon)).toBe('2025');
    expect(afternoon.format(DATE_FORMATS.day)).toBe('Sep 1, 2025 15:00');
    expect(afternoon.format(DATE_FORMATS.week)).toBe('Sep 1, 2025');
  });
});

describe('createTopHeaderGroups', () => {
  it('groups daily ticks into month headers', () => {
    expect(
      createTopHeaderGroups(ticks('2025-01-30', '2025-01-31', '2025-02-01'), 'month'),
    ).toMatchObject([
      { label: 'Jan 2025', widthPx: 64 },
      { label: 'Feb 2025', widthPx: 32 },
    ]);
    expect(createTopHeaderGroups([], 'month')).toEqual([]);
  });

  it('groups monthly ticks into year headers at year scale', () => {
    expect(
      createTopHeaderGroups(ticks('2025-11-01', '2025-12-01', '2026-01-01'), 'year'),
    ).toMatchObject([
      { label: '2025', widthPx: 64 },
      { label: '2026', widthPx: 32 },
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

describe('getSmartGanttPath', () => {
  it('draws rounded FS elbows (cornerRadius 7)', () => {
    expect(getSmartGanttPath('FS', 0, 0, 100, 50)).toBe(
      'M 0 0 h 43 a 7 7 0 0 1 7 7 v 36 a 7 7 0 0 0 7 7 h 43',
    );
    expect(getSmartGanttPath('FS', 0, 50, 100, 0)).toBe(
      'M 0 50 h 43 a 7 7 0 0 0 7 -7 v -36 a 7 7 0 0 1 7 -7 h 43',
    );
  });

  it('falls back for off-screen rows and unknown dependency types', () => {
    expect(getSmartGanttPath('FS', 10, 5, 110, -3)).toBe('M 10 5 h 50');
    expect(getSmartGanttPath('XX', 0, 0, 10, 20)).toBe('M 0 0 L 10 20');
  });
});

describe('computeTimelineData', () => {
  it('pads the range by 5 ticks on each side and positions bars', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-01-10', '2025-01-12')],
      'month',
    );
    expect(bottomCells).toHaveLength(12); // 2025-01-05 .. 2025-01-16
    expect(transformedTasks[0]).toMatchObject({ barLeft: 160, barWidth: 64 }); // 5*32, 2*32
    expect(computeTimelineData([], 'month')).toEqual({ bottomCells: [], transformedTasks: [] });
  });
});
