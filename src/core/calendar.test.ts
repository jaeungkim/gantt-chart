import { describe, expect, it } from 'vitest';
import { CALENDAR_DAYS, createWorkingCalendar } from './calendar';
import dayjs from './dates';

// June 2025: 2nd Mon, 6th Fri, 7th/8th weekend, 9th the next Mon.
const d = (iso: string) => dayjs(`2025-${iso}`);
const iso = (date: { toISOString(): string }) => date.toISOString().slice(0, 16);

const workweek = createWorkingCalendar();
const withHoliday = createWorkingCalendar({ holidays: ['2025-06-09'] });

describe('CALENDAR_DAYS - the default, every day counts', () => {
  it('adds plain calendar days', () => {
    expect(iso(CALENDAR_DAYS.addDays(d('06-06'), 1))).toBe('2025-06-07T00:00');
    expect(iso(CALENDAR_DAYS.addDays(d('06-09'), -3))).toBe('2025-06-06T00:00');
  });

  it('counts plain calendar days', () => {
    expect(CALENDAR_DAYS.daysBetween(d('06-02'), d('06-09'))).toBe(7);
    expect(CALENDAR_DAYS.daysBetween(d('06-09'), d('06-02'))).toBe(-7);
  });

  it('never snaps', () => {
    expect(iso(CALENDAR_DAYS.snapForward(d('06-07')))).toBe('2025-06-07T00:00');
    expect(CALENDAR_DAYS.skipsNonWorkingDays).toBe(false);
  });
});

describe('working-day calendar', () => {
  it('steps over the weekend', () => {
    expect(iso(workweek.addDays(d('06-06'), 1))).toBe('2025-06-09T00:00');
    expect(iso(workweek.addDays(d('06-02'), 5))).toBe('2025-06-09T00:00');
    expect(iso(workweek.addDays(d('06-02'), 10))).toBe('2025-06-16T00:00');
  });

  it('steps back over the weekend', () => {
    expect(iso(workweek.addDays(d('06-09'), -1))).toBe('2025-06-06T00:00');
    expect(iso(workweek.addDays(d('06-09'), -5))).toBe('2025-06-02T00:00');
  });

  it('keeps the time of day', () => {
    expect(iso(workweek.addDays(d('06-06T14:30'), 1))).toBe('2025-06-09T14:30');
  });

  it('counts only working days between two dates', () => {
    expect(workweek.daysBetween(d('06-02'), d('06-09'))).toBe(5);
    expect(workweek.daysBetween(d('06-06'), d('06-09'))).toBe(1);
    expect(workweek.daysBetween(d('06-06'), d('06-08'))).toBe(0); // Fri -> Sun
    expect(workweek.daysBetween(d('06-09'), d('06-02'))).toBe(-5);
  });

  it('inverts addDays exactly, from any working day', () => {
    for (const from of ['06-02', '06-05', '06-11', '06-30']) {
      for (const days of [-7, -3, -1, 0, 1, 4, 9]) {
        const moved = workweek.addDays(d(from), days);
        expect(`${from}${days}: ${workweek.daysBetween(d(from), moved)}`).toBe(
          `${from}${days}: ${days}`
        );
      }
    }
  });

  it('measures a non-working anchor from the working day the walk would reach', () => {
    // Saturday is never counted either way.
    expect(workweek.daysBetween(d('06-07'), d('06-09'))).toBe(1);
    expect(workweek.daysBetween(d('06-07'), d('06-06'))).toBe(0);
    expect(workweek.daysBetween(d('06-06'), d('06-07'))).toBe(0);
  });

  it('skips a holiday as well as the weekend', () => {
    expect(iso(withHoliday.addDays(d('06-06'), 1))).toBe('2025-06-10T00:00');
    expect(withHoliday.daysBetween(d('06-06'), d('06-13'))).toBe(4);
  });

  it('honours a custom non-working-day predicate', () => {
    // Wednesdays off, weekends on
    const custom = createWorkingCalendar({
      isNonWorkingDay: (date) => date.day() === 3,
    });
    expect(iso(custom.addDays(d('06-03'), 1))).toBe('2025-06-05T00:00');
    expect(custom.daysBetween(d('06-02'), d('06-09'))).toBe(6);
  });

  it('snaps a non-working day forward, keeping the time of day', () => {
    expect(iso(workweek.snapForward(d('06-07T09:00')))).toBe('2025-06-09T09:00');
    expect(iso(workweek.snapForward(d('06-08')))).toBe('2025-06-09T00:00');
    expect(iso(workweek.snapForward(d('06-06')))).toBe('2025-06-06T00:00');
  });

  describe('daysUntil / daysUpTo', () => {
    it('daysUntil is the smallest step that clears the target', () => {
      // One working day lands on Mon 09:00, so clearing Mon 17:00 takes two.
      expect(workweek.daysUntil(d('06-06T09:00'), d('06-09T09:00'))).toBe(1);
      expect(workweek.daysUntil(d('06-06T09:00'), d('06-09T17:00'))).toBe(2);
      expect(workweek.daysUntil(d('06-09'), d('06-04'))).toBe(-3);
      expect(workweek.daysUntil(d('06-09'), d('06-09'))).toBe(0);
    });

    it('daysUpTo is the largest step that stays inside the target', () => {
      expect(workweek.daysUpTo(d('06-06T09:00'), d('06-09T09:00'))).toBe(1);
      expect(workweek.daysUpTo(d('06-06T09:00'), d('06-09T08:00'))).toBe(0);
      expect(workweek.daysUpTo(d('06-02'), d('06-08'))).toBe(4); // Sun -> back to Fri
      expect(workweek.daysUpTo(d('06-09'), d('06-04'))).toBe(-3);
    });

    it('agree when the target is exactly reachable', () => {
      const target = workweek.addDays(d('06-03T11:00'), 6);
      expect(workweek.daysUntil(d('06-03T11:00'), target)).toBe(6);
      expect(workweek.daysUpTo(d('06-03T11:00'), target)).toBe(6);
    });
  });

  it('falls back to plain days rather than hanging on a calendar with no working day', () => {
    const nothing = createWorkingCalendar({ isNonWorkingDay: () => true });
    expect(iso(nothing.addDays(d('06-02'), 3))).toBe('2025-06-05T00:00');
    expect(iso(nothing.snapForward(d('06-02')))).toBe('2025-06-02T00:00');
  });
});
