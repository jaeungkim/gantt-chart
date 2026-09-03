import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * The chart's own dayjs - always parses and displays in UTC, so the same data lands in the
 * same cells for every viewer and DST never changes a cell's width (#84, #28).
 */
const ganttDayjs = dayjs.utc;

export default ganttDayjs;

/** Calendar quarter of the date, 1-4 - inlined so dayjs' quarterOfYear plugin stays out of the bundle */
export function quarterOfYear(date: Dayjs): number {
  return Math.floor(date.month() / 3) + 1;
}

/** First moment of the calendar quarter the date falls in */
export function startOfQuarter(date: Dayjs): Dayjs {
  return date.startOf('month').month(Math.floor(date.month() / 3) * 3);
}

/**
 * First moment of the week the date falls in; `firstDayOfWeek` is 0 = Sunday .. 6 = Saturday.
 * Computed here because dayjs' `startOf('week')` is fixed to the loaded locale.
 */
export function startOfWeek(date: Dayjs, firstDayOfWeek = 0): Dayjs {
  const daysIntoWeek = (date.day() - firstDayOfWeek + 7) % 7;
  return date.startOf('day').subtract(daysIntoWeek, 'day');
}
