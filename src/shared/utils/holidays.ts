import dayjs from "core/dates";
import type { Holiday } from "shared/types";

const FORMAT = "YYYY-MM-DD";
const MAX_HOLIDAY_DAYS = 366;

interface HolidayBand {
  key: string;
  label?: string;
  color?: string;
}

interface HolidayIndex {
  byDate: Map<string, HolidayBand>;
  dates: string[];
}

const EMPTY: HolidayIndex = { byDate: new Map(), dates: [] };

export function indexHolidays(
  holidays: (string | Holiday)[] | undefined
): HolidayIndex {
  if (!holidays?.length) return EMPTY;

  const byDate = new Map<string, HolidayBand>();

  for (const [index, entry] of holidays.entries()) {
    const holiday = typeof entry === "string" ? { date: entry } : entry;
    const start = dayjs(holiday.date);
    if (!start.isValid()) continue;

    const end = holiday.endDate ? dayjs(holiday.endDate) : start;
    const span =
      end.isValid() && !end.isBefore(start, "day")
        ? Math.min(end.diff(start, "day"), MAX_HOLIDAY_DAYS - 1)
        : 0;

    const band = { key: `holiday-${index}`, label: holiday.label, color: holiday.color };
    for (let day = 0; day <= span; day++) {
      const key = start.add(day, "day").format(FORMAT);
      if (!byDate.has(key)) byDate.set(key, band);
    }
  }

  return { byDate, dates: [...byDate.keys()] };
}
