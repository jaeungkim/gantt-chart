import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export default dayjs.utc;

export function quarterOfYear(date: Dayjs): number {
  return Math.floor(date.month() / 3) + 1;
}

export function startOfQuarter(date: Dayjs): Dayjs {
  return date.startOf('month').month(Math.floor(date.month() / 3) * 3);
}

export function startOfWeek(date: Dayjs, firstDayOfWeek = 0): Dayjs {
  const daysIntoWeek = (date.day() - firstDayOfWeek + 7) % 7;
  return date.startOf('day').subtract(daysIntoWeek, 'day');
}
