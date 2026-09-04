import dayjs from "dayjs";
import type { Holiday } from "shared/types";

const FORMAT = "YYYY-MM-DD";
// A typo'd `endDate` - 2026 written 2099 - must not expand into a decade of strings
const MAX_HOLIDAY_DAYS = 366;

export interface HolidayIndex {
  /** Every day a holiday covers, `YYYY-MM-DD` -> the holiday covering it */
  byDate: Map<string, Holiday>;
  /** The same days, flat - what `createWorkingCalendar` takes */
  dates: string[];
}

const EMPTY: HolidayIndex = { byDate: new Map(), dates: [] };

/**
 * Expands `holidays` into a per-day lookup. A bare string is a holiday with no label.
 * The first entry covering a day wins, so a later duplicate cannot rewrite its label.
 */
export function indexHolidays(
  holidays: (string | Holiday)[] | undefined
): HolidayIndex {
  if (!holidays?.length) return EMPTY;

  const byDate = new Map<string, Holiday>();

  for (const entry of holidays) {
    const holiday = typeof entry === "string" ? { date: entry } : entry;
    const start = dayjs(holiday.date);
    if (!start.isValid()) continue;

    const end = holiday.endDate ? dayjs(holiday.endDate) : start;
    // A backwards or absurd range collapses to the single start day rather than throwing
    const span =
      end.isValid() && !end.isBefore(start, "day")
        ? Math.min(end.diff(start, "day"), MAX_HOLIDAY_DAYS - 1)
        : 0;

    for (let day = 0; day <= span; day++) {
      const key = start.add(day, "day").format(FORMAT);
      if (!byDate.has(key)) byDate.set(key, holiday);
    }
  }

  return { byDate, dates: [...byDate.keys()] };
}
