/**
 * @deprecated Use dayjs library instead
 */
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM';

/**
 * @deprecated Use dayjs library instead
 */
export interface DateInfo {
  formatted: string;
  year: string;
  month: string;
  day: string;
  weekday: Weekday;
  date: Date;
}

export type DateUnit = 'day' | 'week' | 'month';

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface DateWithWidth {
  date: string; // ISO string format
  width: number; // Width in rem of that specific date
}
