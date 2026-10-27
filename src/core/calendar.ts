/** Day arithmetic that can skip non-working days. See https://gantt.jaeungkim.com/docs/ref/core-calendar */
export interface WorkingCalendar {
  /** False for the default calendar (every day counts). */
  readonly skipsNonWorkingDays: boolean;
  /** Whether the date counts as a working day; always true for the default calendar. */
  isWorkingDay(date: Date): boolean;
  /** Moves `days` days forward (or backward), skipping non-working days. */
  addDays(date: Date, days: number): Date;
  /** Days from `from` to `to`, counted the same way `addDays` moves. Signed. */
  daysBetween(from: Date, to: Date): number;
  /** The date itself when it is a working day, otherwise the next one (time of day kept). */
  snapForward(date: Date): Date;
}

/** Which days `createWorkingCalendar` counts as working. See https://gantt.jaeungkim.com/docs/ref/core-calendar */
export interface WorkingCalendarOptions {
  /** Working weekdays as UTC day numbers, 0 = Sunday (default Mon-Fri). */
  workingWeekdays?: number[];
  /** Non-working dates as UTC `YYYY-MM-DD` strings, matched exactly (default none). */
  holidays?: string[];
}

const DAY_MS = 86_400_000;
const MAX_NON_WORKING_RUN = 366;
const MAX_COUNTED_SPAN_DAYS = 18_263;

const DEFAULT_WORKING_WEEKDAYS = [1, 2, 3, 4, 5];

const shift = (ms: number, days: number) => ms + days * DAY_MS;
const startOfDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;

function build(isOff: ((date: Date) => boolean) | null): WorkingCalendar {
  const isWorkingDay = isOff ? (date: Date) => !isOff(date) : () => true;
  const isWorkingMs = (ms: number) => isWorkingDay(new Date(ms));

  const addDays: WorkingCalendar['addDays'] = (date, days) => {
    const from = date.getTime();
    if (!days || !isOff) return new Date(shift(from, days));

    const step = days > 0 ? 1 : -1;
    let remaining = Math.abs(days);
    let cursor = from;
    let guard = remaining + MAX_NON_WORKING_RUN * remaining;

    while (remaining > 0) {
      cursor = shift(cursor, step);
      if (isWorkingMs(cursor)) remaining--;
      if (guard-- <= 0) return new Date(shift(from, days));
    }
    return new Date(cursor);
  };

  const daysBetween: WorkingCalendar['daysBetween'] = (from, to) => {
    const a = startOfDay(from.getTime());
    const b = startOfDay(to.getTime());
    const plain = (b - a) / DAY_MS;
    if (!isOff || plain === 0) return plain;
    if (Math.abs(plain) > MAX_COUNTED_SPAN_DAYS) return plain;

    const sign = plain > 0 ? 1 : -1;
    let cursor = sign > 0 ? a : b;
    const end = sign > 0 ? b : a;
    let count = 0;
    while (cursor < end) {
      cursor = shift(cursor, 1);
      if (isWorkingMs(cursor)) count++;
    }
    return count === 0 ? 0 : count * sign;
  };

  return {
    skipsNonWorkingDays: isOff !== null,
    isWorkingDay,
    addDays,
    daysBetween,

    snapForward(date) {
      if (!isOff || isWorkingDay(date)) return date;
      let cursor = date.getTime();
      for (let i = 0; i < MAX_NON_WORKING_RUN; i++) {
        cursor = shift(cursor, 1);
        if (isWorkingMs(cursor)) return new Date(cursor);
      }
      return date;
    },
  };
}

/** The default calendar: every day counts, so arithmetic through it is plain calendar arithmetic. See https://gantt.jaeungkim.com/docs/ref/core-calendar */
export const CALENDAR_DAYS: WorkingCalendar = build(null);

/** A calendar that skips weekends and holidays (default Mon-Fri, no holidays). See https://gantt.jaeungkim.com/docs/ref/core-calendar */
export function createWorkingCalendar(
  options: WorkingCalendarOptions = {}
): WorkingCalendar {
  const working = new Set(options.workingWeekdays ?? DEFAULT_WORKING_WEEKDAYS);
  const holidaySet = new Set(options.holidays ?? []);
  return build(
    (date) =>
      !working.has(date.getUTCDay()) ||
      holidaySet.has(date.toISOString().slice(0, 10))
  );
}
