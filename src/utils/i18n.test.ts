import { describe, expect, it, vi } from 'vitest';
import { GanttScaleKey } from 'types/gantt';
import dayjs, { quarterOfYear, startOfQuarter, startOfWeek } from 'utils/dayjs';
import { resolveFormatters, resolveLabelUnit } from './i18n';
import { createTopHeaderGroups } from './timeline';

// 2025-09-01 is a Monday, 15:00 UTC
const afternoon = dayjs('2025-09-01T15:00');
const SCALES: GanttScaleKey[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

// month scale cells: 32px each (see utils.test.ts)
const ticks = (...days: string[]) => days.map((d) => ({ startDate: dayjs(d), widthPx: 32 }));

const labelsFor = (scale: GanttScaleKey, options?: Parameters<typeof resolveFormatters>[1]) => {
  const { tick, header, tooltip } = resolveFormatters(scale, options);
  return [tick(afternoon), header(afternoon), tooltip(afternoon)];
};

describe('quarterOfYear / startOfQuarter', () => {
  it('numbers quarters 1-4 and snaps to the quarter start', () => {
    expect([0, 2, 3, 5, 6, 8, 9, 11].map((m) => quarterOfYear(afternoon.month(m)))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
    expect(startOfQuarter(afternoon).toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(startOfQuarter(dayjs('2025-01-31T23:59')).toISOString()).toBe(
      '2025-01-01T00:00:00.000Z',
    );
  });
});

describe('startOfWeek', () => {
  const wednesday = dayjs('2025-09-03T15:00');

  it('walks back to the configured first day of the week', () => {
    expect(startOfWeek(wednesday).toISOString()).toBe('2025-08-31T00:00:00.000Z'); // Sunday
    expect(startOfWeek(wednesday, 1).toISOString()).toBe('2025-09-01T00:00:00.000Z'); // Monday
    expect(startOfWeek(wednesday, 6).toISOString()).toBe('2025-08-30T00:00:00.000Z'); // Saturday
  });

  it('keeps a date that is already the first day of its week', () => {
    expect(startOfWeek(dayjs('2025-09-01T09:00'), 1).toISOString()).toBe(
      '2025-09-01T00:00:00.000Z',
    );
  });
});

describe('resolveLabelUnit', () => {
  it('takes the label unit from the scale config', () => {
    expect(SCALES.map((s) => resolveLabelUnit(s))).toEqual([
      'day',
      'day',
      'month',
      'month',
      'quarter',
      'year',
    ]);
  });

  it('groups the week scale by week once a first day of the week is given', () => {
    expect(resolveLabelUnit('week', { firstDayOfWeek: 1 })).toBe('week');
    expect(resolveLabelUnit('week', { firstDayOfWeek: 0 })).toBe('week');
    // Other scales have no week grouping to switch to
    expect(resolveLabelUnit('month', { firstDayOfWeek: 1 })).toBe('month');
    expect(resolveLabelUnit('week', { locale: 'ko-KR' })).toBe('month');
  });
});

describe('resolveFormatters without options', () => {
  it('reproduces the built-in labels exactly', () => {
    expect(SCALES.map((s) => labelsFor(s))).toEqual([
      ['15:00', 'Sep 1, 2025', 'Sep 1, 2025 15:00 UTC'],
      ['15', 'Sep 1, 2025', 'Sep 1, 2025 15:00 UTC'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['Sep', 'Q3 2025', 'Sep 2025'],
      ['Sep', '2025', 'Sep 2025'],
    ]);
  });

  it('is unchanged by an empty options object', () => {
    expect(SCALES.map((s) => labelsFor(s, {}))).toEqual(SCALES.map((s) => labelsFor(s)));
  });
});

describe('resolveFormatters with a locale', () => {
  it('renders en-US through Intl', () => {
    expect(SCALES.map((s) => labelsFor(s, { locale: 'en-US' }))).toEqual([
      ['15:00', 'Sep 1, 2025', 'Sep 1, 2025, 15:00 UTC'],
      ['15', 'Sep 1, 2025', 'Sep 1, 2025, 15:00 UTC'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['Sep', 'Q3 2025', 'Sep 2025'],
      ['Sep', '2025', 'Sep 2025'],
    ]);
  });

  it('renders ko-KR month and day names', () => {
    expect(SCALES.map((s) => labelsFor(s, { locale: 'ko-KR' }))).toEqual([
      ['15:00', '2025년 9월 1일', '2025년 9월 1일 15:00 UTC'],
      ['15시', '2025년 9월 1일', '2025년 9월 1일 15:00 UTC'],
      ['1일', '2025년 9월', '2025년 9월 1일'],
      ['1일', '2025년 9월', '2025년 9월 1일'],
      ['9월', '2025년 Q3', '2025년 9월'],
      ['9월', '2025년', '2025년 9월'],
    ]);
  });

  it('keeps labelling in UTC whatever the locale', () => {
    // 23:00 UTC is the next day in Seoul - the label has to stay on the cell it sits in
    const lateNight = dayjs('2025-09-01T23:00');
    expect(resolveFormatters('day', { locale: 'ko-KR' }).header(lateNight)).toBe(
      '2025년 9월 1일',
    );
    expect(resolveFormatters('hour', { locale: 'ko-KR' }).tick(lateNight)).toBe('23:00');
  });

  it('falls back to the built-in labels on an unusable tag, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(labelsFor('month', { locale: 'en_US' })).toEqual(labelsFor('month'));
    expect(labelsFor('year', { locale: 'en_US' })).toEqual(labelsFor('year'));

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('resolveFormatters with format overrides', () => {
  it('wins over both the locale and the built-in labels, per label', () => {
    const { tick, header, tooltip } = resolveFormatters('quarter', {
      locale: 'ko-KR',
      formats: { quarter: { header: (d) => `${d.year()}년 ${quarterOfYear(d)}분기` } },
    });

    expect(header(afternoon)).toBe('2025년 3분기');
    // The untouched labels keep the locale's output
    expect(tick(afternoon)).toBe('9월');
    expect(tooltip(afternoon)).toBe('2025년 9월');
  });

  it('leaves other scales alone', () => {
    const options = { formats: { hour: { tick: () => 'X' } } };
    expect(resolveFormatters('hour', options).tick(afternoon)).toBe('X');
    expect(resolveFormatters('day', options).tick(afternoon)).toBe('15');
  });
});

describe('createTopHeaderGroups with locale options', () => {
  it('labels the groups in the given locale', () => {
    expect(
      createTopHeaderGroups(ticks('2025-01-30', '2025-01-31', '2025-02-01'), 'month', {
        locale: 'ko-KR',
      }),
    ).toMatchObject([
      { label: '2025년 1월', widthPx: 64 },
      { label: '2025년 2월', widthPx: 32 },
    ]);
  });

  it('groups the week scale by week, starting on the configured day', () => {
    const week = ticks(
      '2025-08-31', // Sunday
      '2025-09-01',
      '2025-09-02',
      '2025-09-03',
      '2025-09-04',
      '2025-09-05',
      '2025-09-06',
      '2025-09-07',
    );

    // Weeks starting Monday: 8/31 stands alone, then 9/1..9/7
    expect(createTopHeaderGroups(week, 'week', { firstDayOfWeek: 1 })).toMatchObject([
      { label: 'Aug 25, 2025', widthPx: 32 },
      { label: 'Sep 1, 2025', widthPx: 224 },
    ]);

    // Weeks starting Sunday: 8/31..9/6, then 9/7
    expect(createTopHeaderGroups(week, 'week', { firstDayOfWeek: 0 })).toMatchObject([
      { label: 'Aug 31, 2025', widthPx: 224 },
      { label: 'Sep 7, 2025', widthPx: 32 },
    ]);

    // Without the setting the week scale still groups by month
    expect(createTopHeaderGroups(week, 'week')).toMatchObject([
      { label: 'Aug 2025', widthPx: 32 },
      { label: 'Sep 2025', widthPx: 224 },
    ]);
  });

  it('labels week groups in the locale too', () => {
    expect(
      createTopHeaderGroups(ticks('2025-09-01', '2025-09-02'), 'week', {
        locale: 'ko-KR',
        firstDayOfWeek: 1,
      }),
    ).toMatchObject([{ label: '2025년 9월 1일', widthPx: 64 }]);
  });
});
