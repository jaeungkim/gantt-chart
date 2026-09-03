import type { Dayjs } from 'dayjs';

/** The calendar every piece of date arithmetic in the core routes through. */
export interface WorkingCalendar {
  /** False for the default calendar (every day counts) */
  readonly skipsNonWorkingDays: boolean;
  isWorkingDay(date: Dayjs): boolean;
  /** Moves `days` days forward (or backward), skipping non-working days */
  addDays(date: Dayjs, days: number): Dayjs;
  /** Days from `from` to `to`, counted the same way `addDays` moves. Signed. */
  daysBetween(from: Dayjs, to: Dayjs): number;
  /** Smallest d where `addDays(from, d) >= target` - how far a task must move to clear a date */
  daysUntil(from: Dayjs, target: Dayjs): number;
  /** Largest d where `addDays(from, d) <= target` - how far a task may slip before it breaks one */
  daysUpTo(from: Dayjs, target: Dayjs): number;
  /** The date itself when it is a working day, otherwise the next one (time of day kept) */
  snapForward(date: Dayjs): Dayjs;
}

export interface WorkingCalendarOptions {
  /** Working weekdays as UTC day numbers, 0 = Sunday (default Mon-Fri) */
  workingWeekdays?: number[];
  /** Non-working dates as UTC `YYYY-MM-DD` strings */
  holidays?: string[];
  /** Replaces the weekday + holiday check entirely */
  isNonWorkingDay?: (date: Dayjs) => boolean;
}

const DAY = 'day';
/** A calendar with no working day at all would loop forever - bail out past this many steps */
const MAX_SKIP = 366;
/** Upper bound on the day-by-day walk in daysBetween (~50 years) */
const MAX_SPAN = 18_263;

const HOLIDAY_FORMAT = 'YYYY-MM-DD';
const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5];

// `isOff` null means every day is a working day (the default calendar).
function build(isOff: ((date: Dayjs) => boolean) | null): WorkingCalendar {
  const isWorkingDay = isOff ? (date: Dayjs) => !isOff(date) : () => true;

  const addDays: WorkingCalendar['addDays'] = (date, days) => {
    if (!days || !isOff) return date.add(days, DAY);

    const step = days > 0 ? 1 : -1;
    let remaining = Math.abs(days);
    let cursor = date;
    let guard = Math.abs(days) + MAX_SKIP * Math.abs(days);

    while (remaining > 0) {
      cursor = cursor.add(step, DAY);
      if (isWorkingDay(cursor)) remaining--;
      // Degenerate calendar (nothing is a working day) - fall back to plain days
      if (guard-- <= 0) return date.add(days, DAY);
    }
    return cursor;
  };

  const daysBetween: WorkingCalendar['daysBetween'] = (from, to) => {
    const a = from.startOf(DAY);
    const b = to.startOf(DAY);
    const plain = b.diff(a, DAY);
    if (!isOff || plain === 0) return plain;
    // Guard against absurd data rather than walking a century one day at a time
    if (Math.abs(plain) > MAX_SPAN) return plain;

    const sign = plain > 0 ? 1 : -1;
    let cursor = sign > 0 ? a : b;
    const end = sign > 0 ? b : a;
    let count = 0;
    while (cursor.valueOf() < end.valueOf()) {
      cursor = cursor.add(1, DAY);
      if (isWorkingDay(cursor)) count++;
    }
    // Not `count * sign` - that hands back -0 for a backwards span of no working days
    return count === 0 ? 0 : count * sign;
  };

  return {
    skipsNonWorkingDays: isOff !== null,
    isWorkingDay,
    addDays,
    daysBetween,

    // daysBetween is day-granular, so correct by whole steps once time of day is counted.
    daysUntil(from, target) {
      let days = daysBetween(from, target);
      const time = target.valueOf();
      for (let i = 0; i < 2 && addDays(from, days).valueOf() < time; i++) days++;
      for (let i = 0; i < 2 && addDays(from, days - 1).valueOf() >= time; i++) days--;
      return days;
    },

    daysUpTo(from, target) {
      let days = daysBetween(from, target);
      const time = target.valueOf();
      for (let i = 0; i < 2 && addDays(from, days).valueOf() > time; i++) days--;
      for (let i = 0; i < 2 && addDays(from, days + 1).valueOf() <= time; i++) days++;
      return days;
    },

    snapForward(date) {
      if (!isOff || isWorkingDay(date)) return date;
      let cursor = date;
      for (let i = 0; i < MAX_SKIP; i++) {
        cursor = cursor.add(1, DAY);
        if (isWorkingDay(cursor)) return cursor;
      }
      return date;
    },
  };
}

/** The default calendar: every day counts, so arithmetic through it is plain calendar arithmetic. */
export const CALENDAR_DAYS: WorkingCalendar = build(null);

/** A calendar that skips weekends and holidays, configured like the chart's non-working-day shading. */
export function createWorkingCalendar(
  options: WorkingCalendarOptions = {}
): WorkingCalendar {
  const { isNonWorkingDay, holidays } = options;
  if (isNonWorkingDay) return build(isNonWorkingDay);

  const working = new Set(options.workingWeekdays ?? DEFAULT_WORKING_WEEKDAYS);
  const holidaySet = new Set(holidays ?? []);
  return build(
    (date) =>
      !working.has(date.day()) || holidaySet.has(date.format(HOLIDAY_FORMAT))
  );
}
