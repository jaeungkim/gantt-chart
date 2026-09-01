import { DATE_FORMATS, GANTT_SCALE_CONFIG } from 'constants/gantt';
import { Dayjs } from 'dayjs';
import {
  GanttFormatters,
  GanttLabelUnit,
  GanttLocaleOptions,
  GanttScaleKey,
} from 'types/gantt';
import { quarterOfYear } from 'utils/dayjs';

/**
 * Label formatting, localized through `Intl.DateTimeFormat`
 *
 * Three layers, first match wins:
 *   1. a per-scale override from `formats`
 *   2. the `locale` tag, rendered by `Intl.DateTimeFormat`
 *   3. the built-in English labels in GANTT_SCALE_CONFIG / DATE_FORMATS
 *
 * With neither prop set the output is exactly layer 3, byte for byte, so charts that
 * do not opt in are untouched.
 *
 * Everything is formatted with `timeZone: 'UTC'` - the chart is drawn in UTC
 * (see utils/dayjs), so a label rendered in the viewer's zone would disagree with the
 * cell it sits in.
 */

const UTC_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};
const UTC_MONTH: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short' };
const UTC_YEAR: Intl.DateTimeFormatOptions = { year: 'numeric' };
// h23 rather than hour12:false - the latter renders midnight as '24' on some ICU builds
const CLOCK: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** Bottom row - one label per tick */
const TICK_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  hour: CLOCK,
  day: { hour: '2-digit', hourCycle: 'h23' },
  week: { day: 'numeric' },
  month: { day: 'numeric' },
  quarter: { month: 'short' },
  year: { month: 'short' },
};

/** Top row - one label per group */
const HEADER_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  hour: UTC_DATE,
  day: UTC_DATE,
  week: UTC_MONTH,
  month: UTC_MONTH,
  quarter: UTC_YEAR,
  year: UTC_YEAR,
};

/** Drag tooltip and drag guides - the zone is spelled out where the time is visible */
const TOOLTIP_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  hour: { ...UTC_DATE, ...CLOCK, timeZoneName: 'short' },
  day: { ...UTC_DATE, ...CLOCK, timeZoneName: 'short' },
  week: UTC_DATE,
  month: UTC_DATE,
  quarter: UTC_MONTH,
  year: UTC_MONTH,
};

/** Locales already reported as unusable - keeps a bad prop from logging on every render */
const warnedLocales = new Set<string>();

function formatterFor(
  locale: string,
  options: Intl.DateTimeFormatOptions
): (date: Dayjs) => string {
  const intl = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
  return (date) => intl.format(date.toDate());
}

/**
 * Quarter label for a locale
 *
 * Intl exposes no quarter field, so the quarter number is bolted onto the localized
 * year. Locales whose year carries a suffix ('2025年', '2025년') read better with the
 * quarter last. Anything more idiomatic - '2025년 3분기' - belongs in a
 * `formats.quarter.header` override.
 */
function quarterHeaderFor(locale: string): (date: Dayjs) => string {
  const year = formatterFor(locale, UTC_YEAR);
  return (date) => {
    const label = year(date);
    const quarter = `Q${quarterOfYear(date)}`;
    return /\d$/.test(label) ? `${quarter} ${label}` : `${label} ${quarter}`;
  };
}

/**
 * Unit the top header row groups by
 *
 * A first day of the week is only meaningful where weeks are the grouping, which is the
 * week scale - and there it is opt-in, so a chart that passes no `firstDayOfWeek` keeps
 * grouping the week scale by month exactly as before.
 */
export function resolveLabelUnit(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttLabelUnit {
  if (scale === 'week' && options?.firstDayOfWeek !== undefined) return 'week';
  return GANTT_SCALE_CONFIG[scale].labelUnit;
}

/**
 * The tick/header/tooltip formatters for one scale
 *
 * Cheap enough to call per render, but it builds `Intl.DateTimeFormat` instances, so
 * callers memoize it on [scale, options].
 */
export function resolveFormatters(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttFormatters {
  const override = options?.formats?.[scale];

  // Week groups need a day-precise header: reusing the week scale's own 'MMM YYYY'
  // would label every week of a month identically and merge them straight back together
  const headerScale = resolveLabelUnit(scale, options) === 'week' ? 'day' : scale;

  const config = GANTT_SCALE_CONFIG[scale];
  const headerConfig = GANTT_SCALE_CONFIG[headerScale];
  const intl = options?.locale
    ? localeFormatters(options.locale, scale, headerScale)
    : null;

  return {
    tick:
      override?.tick ??
      intl?.tick ??
      ((date) => config.formatTickLabel?.(date) ?? ''),
    header:
      override?.header ??
      intl?.header ??
      ((date) => headerConfig.formatHeaderLabel?.(date) ?? date.format()),
    tooltip:
      override?.tooltip ??
      intl?.tooltip ??
      ((date) => date.format(DATE_FORMATS[scale])),
  };
}

/**
 * Formatters for a locale tag, or null when the tag is unusable
 *
 * `Intl.DateTimeFormat` throws on a malformed tag ('en_US', 'ko kr'), and a label
 * formatter is no reason to take the whole chart down - the built-in labels are used
 * instead and the tag is reported once.
 */
function localeFormatters(
  locale: string,
  scale: GanttScaleKey,
  headerScale: GanttScaleKey
): GanttFormatters | null {
  try {
    return {
      tick: formatterFor(locale, TICK_OPTIONS[scale]),
      header:
        headerScale === 'quarter'
          ? quarterHeaderFor(locale)
          : formatterFor(locale, HEADER_OPTIONS[headerScale]),
      tooltip: formatterFor(locale, TOOLTIP_OPTIONS[scale]),
    };
  } catch {
    if (!warnedLocales.has(locale)) {
      warnedLocales.add(locale);
      console.warn(
        `[gantt-chart] Unusable locale "${locale}" - falling back to the built-in labels.`
      );
    }
    return null;
  }
}
