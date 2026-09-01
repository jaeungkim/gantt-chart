import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Only the plugins actually used are registered.
// (12 used to be registered with no caller at all - they only grew the bundle)
dayjs.extend(utc);

/**
 * The chart's own dayjs - always parses and displays in UTC mode.
 *
 * The contract for task dates is "UTC ISO string" (README > Task Format), so
 * positioning and labels follow UTC too. Parsing in local mode would draw the same
 * data in different date cells depending on where the viewer is (#84), and local
 * calendar DST days (23/25 hours) would make cell widths wobble as well (#28).
 *
 * - A string carrying a zone ('...Z', '+09:00') displays that instant as a UTC time
 * - A string without a zone ('2025-06-01', '2025-06-01T09:00') is read as a UTC wall
 *   clock, so it displays exactly as written, whatever the viewer's time zone
 */
const ganttDayjs = dayjs.utc;

export default ganttDayjs;

/**
 * Calendar quarter of the date, 1-4
 *
 * Written out instead of pulling in dayjs' quarterOfYear plugin - the quarter scale
 * needs exactly these two lines of it, and the plugin would grow the bundle for every
 * consumer, quarter scale in use or not.
 */
export function quarterOfYear(date: Dayjs): number {
  return Math.floor(date.month() / 3) + 1;
}

/** First moment of the calendar quarter the date falls in */
export function startOfQuarter(date: Dayjs): Dayjs {
  return date.startOf('month').month(Math.floor(date.month() / 3) * 3);
}

/**
 * First moment of the week the date falls in
 *
 * `firstDayOfWeek` is 0 = Sunday .. 6 = Saturday. dayjs' own `startOf('week')` is fixed
 * to the locale dayjs was loaded with (Sunday), so the week boundary is computed here.
 */
export function startOfWeek(date: Dayjs, firstDayOfWeek = 0): Dayjs {
  const daysIntoWeek = (date.day() - firstDayOfWeek + 7) % 7;
  return date.startOf('day').subtract(daysIntoWeek, 'day');
}
