import { describe, expect, it } from 'vitest';
import type { Task } from 'shared/task';
import dayjs from 'core/dates';
import {
  clampDragDates,
  clampMoveDelta,
  computeTimelineData,
  pxBetweenDates,
} from './geometry';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'a',
  name: 'a',
  startDate: '2025-06-10T00:00:00Z',
  endDate: '2025-06-14T00:00:00Z',
  parentId: null,
  sequence: '1',
  ...overrides,
});

const iso = (d: { toISOString(): string }) => d.toISOString();

describe('clampDragDates - drag bounds (#42)', () => {
  const start = dayjs('2025-06-10T00:00:00Z');
  const end = dayjs('2025-06-14T00:00:00Z');
  const min = dayjs('2025-06-05T00:00:00Z');
  const max = dayjs('2025-06-20T00:00:00Z');

  it('returns the dates untouched when no bound is set', () => {
    const out = clampDragDates('bar', start, end, {}, 'month');
    expect(out.startDate).toBe(start);
    expect(out.endDate).toBe(end);
  });

  it('leaves a drag that stays inside the window alone', () => {
    const out = clampDragDates(
      'bar',
      dayjs('2025-06-08T00:00:00Z'),
      dayjs('2025-06-12T00:00:00Z'),
      { min, max },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-08T00:00:00.000Z');
    expect(iso(out.endDate)).toBe('2025-06-12T00:00:00.000Z');
  });

  it('snaps a move to the min bound and keeps the bar length', () => {
    const out = clampDragDates(
      'bar',
      dayjs('2025-06-01T00:00:00Z'),
      dayjs('2025-06-05T00:00:00Z'),
      { min, max },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-05T00:00:00.000Z');
    expect(iso(out.endDate)).toBe('2025-06-09T00:00:00.000Z');
  });

  it('snaps a move to the max bound and keeps the bar length', () => {
    const out = clampDragDates(
      'bar',
      dayjs('2025-06-25T00:00:00Z'),
      dayjs('2025-06-29T00:00:00Z'),
      { min, max },
      'month'
    );
    expect(iso(out.endDate)).toBe('2025-06-20T00:00:00.000Z');
    expect(iso(out.startDate)).toBe('2025-06-16T00:00:00.000Z');
  });

  it('clamps against one open-ended bound without inventing the other', () => {
    const out = clampDragDates(
      'bar',
      dayjs('2025-06-01T00:00:00Z'),
      dayjs('2025-07-30T00:00:00Z'),
      { min },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-05T00:00:00.000Z');
    expect(iso(out.endDate)).toBe('2025-08-03T00:00:00.000Z');
  });

  it('keeps min when the bar is longer than the window itself', () => {
    const out = clampDragDates(
      'bar',
      dayjs('2025-06-01T00:00:00Z'),
      dayjs('2025-07-01T00:00:00Z'),
      { min, max },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-05T00:00:00.000Z');
  });

  it('snaps a left resize to the min bound, leaving the right edge alone', () => {
    const out = clampDragDates(
      'left',
      dayjs('2025-05-20T00:00:00Z'),
      end,
      { min, max },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-05T00:00:00.000Z');
    expect(out.endDate).toBe(end);
  });

  it('snaps a right resize to the max bound, leaving the left edge alone', () => {
    const out = clampDragDates(
      'right',
      start,
      dayjs('2025-07-20T00:00:00Z'),
      { min, max },
      'month'
    );
    expect(out.startDate).toBe(start);
    expect(iso(out.endDate)).toBe('2025-06-20T00:00:00.000Z');
  });
});

describe('clampDragDates - bounds composed with the invert clamp (#42)', () => {
  it('keeps a left resize at least one drag step wide inside a wide window', () => {
    const out = clampDragDates(
      'left',
      dayjs('2025-06-30T00:00:00Z'),
      dayjs('2025-06-14T00:00:00Z'),
      { min: dayjs('2025-06-01T00:00:00Z'), max: dayjs('2025-06-30T00:00:00Z') },
      'month'
    );
    // Bound alone would allow 06-30, which is past the fixed end - one day back instead
    expect(iso(out.startDate)).toBe('2025-06-13T00:00:00.000Z');
    expect(out.startDate.valueOf()).toBeLessThan(out.endDate.valueOf());
  });

  it('keeps a right resize at least one drag step wide inside a wide window', () => {
    const out = clampDragDates(
      'right',
      dayjs('2025-06-14T00:00:00Z'),
      dayjs('2025-06-01T00:00:00Z'),
      { min: dayjs('2025-06-05T00:00:00Z'), max: dayjs('2025-06-30T00:00:00Z') },
      'month'
    );
    expect(iso(out.endDate)).toBe('2025-06-15T00:00:00.000Z');
    expect(out.endDate.valueOf()).toBeGreaterThan(out.startDate.valueOf());
  });

  it('uses the scale drag step, so a year-scale resize keeps a 28-day minimum', () => {
    const out = clampDragDates(
      'right',
      dayjs('2025-06-14T00:00:00Z'),
      dayjs('2025-06-01T00:00:00Z'),
      { min: dayjs('2025-06-05T00:00:00Z') },
      'year'
    );
    expect(iso(out.endDate)).toBe('2025-07-12T00:00:00.000Z');
  });

  it('never inverts, even when the task already sits outside its own window', () => {
    // min is past the fixed right edge - non-inversion wins over the bound
    const out = clampDragDates(
      'left',
      dayjs('2025-06-10T00:00:00Z'),
      dayjs('2025-06-14T00:00:00Z'),
      { min: dayjs('2025-08-01T00:00:00Z') },
      'month'
    );
    expect(iso(out.startDate)).toBe('2025-06-13T00:00:00.000Z');
    expect(out.startDate.valueOf()).toBeLessThan(out.endDate.valueOf());
  });
});

describe('pxBetweenDates (#42)', () => {
  it('matches a whole number of drag steps at every scale', () => {
    // week: 6 hours per step at 18px (72px a day), year: 28 days per step at 28px
    expect(
      pxBetweenDates(
        dayjs('2025-06-10T00:00:00Z'),
        dayjs('2025-06-13T00:00:00Z'),
        'week'
      )
    ).toBe(216);
    expect(
      pxBetweenDates(
        dayjs('2025-06-10T00:00:00Z'),
        dayjs('2025-07-08T00:00:00Z'),
        'year'
      )
    ).toBe(28);
  });

  it('measures a part-step clamp as a fraction of a step', () => {
    expect(
      pxBetweenDates(
        dayjs('2025-06-10T00:00:00Z'),
        dayjs('2025-06-10T12:00:00Z'),
        'week'
      )
    ).toBe(36);
  });

  it('is negative for a leftward clamp', () => {
    expect(
      pxBetweenDates(
        dayjs('2025-06-10T00:00:00Z'),
        dayjs('2025-06-08T00:00:00Z'),
        'week'
      )
    ).toBe(-144);
  });
});

describe('computeTimelineData - fixed visible range (#42)', () => {
  const tasks = [task()];
  const cells = (range?: { start?: string; end?: string }) =>
    computeTimelineData(
      tasks,
      'week',
      range && {
        start: range.start ? dayjs(range.start) : undefined,
        end: range.end ? dayjs(range.end) : undefined,
      }
    ).bottomCells;

  it('auto-fits with a 5-tick buffer when no range is given', () => {
    const out = cells();
    expect(iso(out[0].startDate)).toBe('2025-06-05T00:00:00.000Z');
    expect(out).toHaveLength(14);
  });

  it('renders exactly the pinned window, ignoring the task dates', () => {
    const out = cells({ start: '2025-01-01', end: '2025-01-11' });
    expect(iso(out[0].startDate)).toBe('2025-01-01T00:00:00.000Z');
    expect(iso(out[out.length - 1].startDate)).toBe('2025-01-10T00:00:00.000Z');
    expect(out).toHaveLength(10);
  });

  it('pins one end and keeps auto-fitting the other', () => {
    const startPinned = cells({ start: '2025-01-01' });
    expect(iso(startPinned[0].startDate)).toBe('2025-01-01T00:00:00.000Z');
    expect(iso(startPinned[startPinned.length - 1].startDate)).toBe(
      '2025-06-18T00:00:00.000Z'
    );

    const endPinned = cells({ end: '2025-12-01' });
    expect(iso(endPinned[0].startDate)).toBe('2025-06-05T00:00:00.000Z');
    expect(iso(endPinned[endPinned.length - 1].startDate)).toBe(
      '2025-11-30T00:00:00.000Z'
    );
  });

  it('draws a fully pinned window even with no tasks at all', () => {
    const out = computeTimelineData([], 'week', {
      start: dayjs('2025-01-01'),
      end: dayjs('2025-01-05'),
    });
    expect(out.bottomCells).toHaveLength(4);
    expect(out.transformedTasks).toEqual([]);
  });

  it('still renders nothing with no tasks and only one end pinned', () => {
    expect(
      computeTimelineData([], 'month', { start: dayjs('2025-01-01') }).bottomCells
    ).toEqual([]);
  });
});

describe('clampMoveDelta - subtree drag bounds (#42 + hierarchy)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const member = (start: string, end: string, min?: string, max?: string) => ({
    start: dayjs(start),
    end: dayjs(end),
    bounds: {
      min: min ? dayjs(min) : undefined,
      max: max ? dayjs(max) : undefined,
    },
  });

  it('passes the requested delta through when nothing is bounded', () => {
    expect(clampMoveDelta([], 5 * DAY, 'month')).toBe(5 * DAY);
  });

  it('shrinks the delta to what the only bounded member allows', () => {
    // 06-10 with a 06-08 floor can only give up 2 days of a 5-day pull left
    const members = [member('2025-06-10', '2025-06-14', '2025-06-08')];
    expect(clampMoveDelta(members, -5 * DAY, 'month')).toBe(-2 * DAY);
  });

  it('takes the tightest bound across the whole subtree', () => {
    // The parent could slide 4 days right; a child may only slide 1
    const members = [
      member('2025-06-10', '2025-06-14', undefined, '2025-06-18'),
      member('2025-06-12', '2025-06-16', undefined, '2025-06-17'),
    ];
    expect(clampMoveDelta(members, 6 * DAY, 'month')).toBe(1 * DAY);
  });

  it('lets a descendant bound block a parent drag entirely', () => {
    const members = [
      member('2025-06-10', '2025-06-14'),
      member('2025-06-12', '2025-06-16', '2025-06-12'),
    ];
    expect(clampMoveDelta(members, -3 * DAY, 'month')).toBe(0);
  });

  it('leaves an unbounded direction alone', () => {
    const members = [member('2025-06-10', '2025-06-14', '2025-06-08')];
    expect(clampMoveDelta(members, 9 * DAY, 'month')).toBe(9 * DAY);
  });

  it('never reverses the drag for a bar already outside its window', () => {
    const members = [member('2025-06-20', '2025-06-24', undefined, '2025-06-15')];
    expect(clampMoveDelta(members, 3 * DAY, 'month')).toBe(0);
  });
});
