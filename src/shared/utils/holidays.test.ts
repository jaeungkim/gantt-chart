import { describe, expect, it } from 'vitest';
import { indexHolidays } from './holidays';

const labelAt = (holidays: Parameters<typeof indexHolidays>[0], date: string) =>
  indexHolidays(holidays).byDate.get(date)?.label;

describe('indexHolidays', () => {
  it('takes a bare string as a day off with no label', () => {
    const { dates, byDate } = indexHolidays(['2026-01-01']);
    expect(dates).toEqual(['2026-01-01']);
    expect(byDate.get('2026-01-01')).toEqual({ date: '2026-01-01' });
  });

  it('expands an endDate range, inclusive of both ends', () => {
    expect(
      indexHolidays([{ date: '2026-09-24', endDate: '2026-09-26', label: 'Chuseok' }]).dates,
    ).toEqual(['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(labelAt([{ date: '2026-09-24', endDate: '2026-09-26', label: 'Chuseok' }], '2026-09-26')).toBe(
      'Chuseok',
    );
  });

  it('caps a runaway range rather than expanding a century of strings', () => {
    expect(indexHolidays([{ date: '2026-01-01', endDate: '2099-01-01' }]).dates).toHaveLength(366);
  });

  it('collapses a backwards or unparseable range to the single start day', () => {
    expect(indexHolidays([{ date: '2026-05-05', endDate: '2026-05-01' }]).dates).toEqual(['2026-05-05']);
    expect(indexHolidays([{ date: '2026-05-05', endDate: 'nonsense' }]).dates).toEqual(['2026-05-05']);
  });

  it('drops an entry whose own date does not parse', () => {
    expect(indexHolidays(['nonsense', '2026-01-01']).dates).toEqual(['2026-01-01']);
  });

  it('keeps the first entry covering a day, so a later duplicate cannot rewrite its label', () => {
    const overlapping = [
      { date: '2026-01-01', label: 'New Year' },
      { date: '2026-01-01', label: 'Something else' },
    ];
    expect(labelAt(overlapping, '2026-01-01')).toBe('New Year');
  });

  it('has nothing to index for undefined or an empty list', () => {
    expect(indexHolidays(undefined).dates).toEqual([]);
    expect(indexHolidays([]).byDate.size).toBe(0);
  });
});
