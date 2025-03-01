import { Weekday } from 'types/date';

export const WEEKDAYS: Weekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

export const MONTHS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
];

const date = new Date();

// 10년 전 부터 10년 후 까지 표시
const startYear = date.getFullYear() - 10;

export const YEARS = Array.from({ length: 21 }, (_, index) =>
  (startYear + index).toString(),
);
