import dayjs from 'dayjs';
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
