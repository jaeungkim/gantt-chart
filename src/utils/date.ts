import { Dayjs } from 'dayjs';
import { GanttTimelineScale } from 'types/gantt';
import dayjs from 'utils/dayjs';

export function generateCustomDateRange(
  unit: 'year' | 'month' | 'day' | 'hour',
  step: number,
  start: Dayjs,
  end: Dayjs,
): Dayjs[] {
  const range: Dayjs[] = [];
  let current = dayjs(start);

  while (current.isBefore(end) || current.isSame(end)) {
    range.push(current);
    current = current.add(step, unit);
  }

  return range;
}

/**
 * Shift a date by a specified step and direction.
 */
export function shiftDate(
  date: Dayjs,
  unit: 'year' | 'month' | 'day' | 'hour',
  stepCount: number,
  stepSize: number,
  direction: 'back' | 'forward',
): Dayjs {
  const multiplier = direction === 'forward' ? 1 : -1;
  return dayjs(date).add(stepSize * stepCount * multiplier, unit);
}

export function formatHeaderLabel(
  date: Dayjs,
  scale: GanttTimelineScale,
): string {
  const timeZone = 'Asia/Seoul';
  const formattedDate = dayjs(date).tz(timeZone).locale('en');

  switch (scale) {
    case 'yearly': // '연간' -> 'yearly'
      return formattedDate.format('YYYY MMM DD'); // Example: "2024 Jan"

    case 'monthly': // '월간' -> 'monthly'
      return formattedDate.format('YYYY MMM DD'); // Example: "2024 Jan 15"

    case 'weekly': // '주간' -> 'weekly'
      return formattedDate.format('YYYY MMM DD'); // Example: "Jan 15"

    default:
      return formattedDate.format('YYYY MMM DD'); // Example: "01-15"
  }
}
