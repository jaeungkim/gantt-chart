import { Dayjs } from 'dayjs';
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
