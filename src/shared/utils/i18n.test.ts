import { describe, expect, it, vi } from 'vitest';
import { GanttScaleKey } from 'shared/types';
import dayjs, { quarterOfYear, startOfQuarter, startOfWeek } from 'core/dates';
import { resolveFormatters, resolveLabelUnit } from './i18n';

const afternoon = dayjs('2025-09-01T15:00');
const SCALES: GanttScaleKey[] = ['day', 'week', 'month', 'quarter', 'year'];

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
    expect(startOfWeek(wednesday).toISOString()).toBe('2025-08-31T00:00:00.000Z');
    expect(startOfWeek(wednesday, 1).toISOString()).toBe('2025-09-01T00:00:00.000Z');
    expect(startOfWeek(wednesday, 6).toISOString()).toBe('2025-08-30T00:00:00.000Z');
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
      'month',
      'month',
      'quarter',
      'year',
    ]);
  });

  it('groups the week scale by week once a first day of the week is given', () => {
    expect(resolveLabelUnit('week', { firstDayOfWeek: 1 })).toBe('week');
    expect(resolveLabelUnit('week', { firstDayOfWeek: 0 })).toBe('week');
    expect(resolveLabelUnit('month', { firstDayOfWeek: 1 })).toBe('month');
    expect(resolveLabelUnit('week', { locale: 'ko-KR' })).toBe('month');
  });
});

describe('resolveFormatters without options', () => {
  it('reproduces the built-in labels exactly', () => {
    expect(SCALES.map((s) => labelsFor(s))).toEqual([
      ['15', 'Sep 1, 2025', 'Sep 1, 2025 15:00 UTC'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['Sep 1', 'Sep 2025', 'Sep 1, 2025'],
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
      ['15', 'Sep 1, 2025', 'Sep 1, 2025, 15:00 UTC'],
      ['1', 'Sep 2025', 'Sep 1, 2025'],
      ['Sep 1', 'Sep 2025', 'Sep 1, 2025'],
      ['Sep', 'Q3 2025', 'Sep 2025'],
      ['Sep', '2025', 'Sep 2025'],
    ]);
  });

  it('renders ko-KR month and day names', () => {
    expect(SCALES.map((s) => labelsFor(s, { locale: 'ko-KR' }))).toEqual([
      ['15시', '2025년 9월 1일', '2025년 9월 1일 15:00 UTC'],
      ['1일', '2025년 9월', '2025년 9월 1일'],
      ['9월 1일', '2025년 9월', '2025년 9월 1일'],
      ['9월', '2025년 Q3', '2025년 9월'],
      ['9월', '2025년', '2025년 9월'],
    ]);
  });

  it('keeps labelling in UTC whatever the locale', () => {
    const lateNight = dayjs('2025-09-01T23:00');
    expect(resolveFormatters('day', { locale: 'ko-KR' }).header(lateNight)).toBe(
      '2025년 9월 1일',
    );
    expect(resolveFormatters('day', { locale: 'ko-KR' }).tick(lateNight)).toBe('23시');
  });

  it('prints an invalid date as the built-in labels do instead of throwing', () => {
    const invalid = dayjs('');
    const { tooltip, edge, range } = resolveFormatters('month', { locale: 'ko-KR' });

    expect(tooltip(invalid)).toBe(resolveFormatters('month').tooltip(invalid));
    expect(edge(invalid)).toBe('Invalid Date');
    expect(range(invalid, dayjs('2026-03-23'))).toBe('Invalid Date – 3월 23일');
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
      formats: { quarter: { header: (d) => `${d.getUTCFullYear()}년 ${quarterOfYear(dayjs(d))}분기` } },
    });

    expect(header(afternoon)).toBe('2025년 3분기');
    expect(tick(afternoon)).toBe('9월');
    expect(tooltip(afternoon)).toBe('2025년 9월');
  });

  it('leaves other scales alone', () => {
    const options = { formats: { week: { tick: () => 'X' } } };
    expect(resolveFormatters('week', options).tick(afternoon)).toBe('X');
    expect(resolveFormatters('day', options).tick(afternoon)).toBe('15');
  });
});

describe('range formatter', () => {
  const start = dayjs('2026-01-15T00:00:00Z');
  const end = dayjs('2026-01-17T00:00:00Z');

  it('joins the built-in labels without repeating the year the header carries', () => {
    expect(resolveFormatters('month').range(start, end)).toBe('Jan 15 – Jan 17');
  });

  it('merges what the two ends share when a locale is set', () => {
    expect(resolveFormatters('month', { locale: 'en-US' }).range(start, end)).toMatch(
      /^Jan 15\s*.\s*17$/,
    );
  });

  it('prints one label when both ends land on the same value', () => {
    expect(resolveFormatters('month').range(start, start)).toBe('Jan 15');
    expect(resolveFormatters('month', { locale: 'en-US' }).range(start, start)).toBe('Jan 15');
  });

  it('survives a range dragged backwards past its own start', () => {
    const { range } = resolveFormatters('month', { locale: 'en-US' });
    expect(() => range(end, start)).not.toThrow();
    expect(range(end, start)).toContain('17');
    expect(range(end, start)).toContain('15');
  });

  it('formats both ends through a tooltip override, which owns the readout', () => {
    const { range } = resolveFormatters('month', {
      locale: 'ko-KR',
      formats: { month: { tooltip: (date) => dayjs(date).format('YY/MM/DD') } },
    });
    expect(range(start, end)).toBe('26/01/15 – 26/01/17');
  });

  it('falls back to the built-ins when the locale tag is unusable', () => {
    expect(resolveFormatters('month', { locale: 'en_US' }).range(start, end)).toBe(
      'Jan 15 – Jan 17',
    );
  });
});

describe('edge formatter', () => {
  const start = dayjs('2026-01-15T09:00:00Z');
  const end = dayjs('2026-01-17T17:00:00Z');

  it('prints one end at the readout precision, with no year', () => {
    const { edge } = resolveFormatters('month');
    expect(edge(start)).toBe('Jan 15');
    expect(edge(end)).toBe('Jan 17');
  });

  it('keeps the year where a span can cross one', () => {
    expect(resolveFormatters('quarter').edge(start)).toBe('Jan 2026');
  });

  it('writes only the clock at the scale whose ticks are hours', () => {
    expect(resolveFormatters('day').edge(start)).toBe('09:00 UTC');
  });

  it('goes through the locale when one is set', () => {
    expect(resolveFormatters('month', { locale: 'ko-KR' }).edge(start)).toBe(
      '1월 15일',
    );
  });

  it('is the tooltip override when one is given, the same function range uses', () => {
    const options = {
      locale: 'ko-KR',
      formats: { month: { tooltip: (date: Date) => dayjs(date).format('YY/MM/DD') } },
    };
    expect(resolveFormatters('month', options).edge(start)).toBe('26/01/15');
    expect(resolveFormatters('month', options).range(start, end)).toBe(
      '26/01/15 – 26/01/17',
    );
  });

  it('is what range collapses to when both ends read alike', () => {
    const { edge, range } = resolveFormatters('month');
    expect(range(start, start)).toBe(edge(start));
  });
});
