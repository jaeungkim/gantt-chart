import { DATE_FORMATS, GANTT_SCALE_CONFIG, RANGE_FORMATS } from 'shared/constants';
import { Dayjs } from 'dayjs';
import {
  GanttFormatters,
  GanttLabelUnit,
  GanttLocaleOptions,
  GanttScaleKey,
} from 'shared/types';
import { quarterOfYear } from 'core/dates';

// Label precedence: a per-scale `formats` override, then `locale` via Intl, then the built-ins.
// Everything formats in UTC - the chart is drawn in UTC, so a viewer-zone label would disagree
// with the cell it sits in.

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

// Bottom row - one label per tick
const TICK_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { hour: '2-digit', hourCycle: 'h23' },
  week: { day: 'numeric' },
  // Week columns - the day number alone would not say which month the week is in
  month: { month: 'short', day: 'numeric' },
  quarter: { month: 'short' },
  year: { month: 'short' },
};

// Top row - one label per group
const HEADER_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: UTC_DATE,
  week: UTC_MONTH,
  month: UTC_MONTH,
  quarter: UTC_YEAR,
  year: UTC_YEAR,
};

// Drag tooltip and guides - the zone is spelled out where a clock time is visible
const TOOLTIP_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { ...UTC_DATE, ...CLOCK, timeZoneName: 'short' },
  week: UTC_DATE,
  month: UTC_DATE,
  quarter: UTC_MONTH,
  year: UTC_MONTH,
};

// Header drag readout - one end of the dragged span. Mirrors RANGE_FORMATS: the year goes
// where the row above the readout already shows it, and stays where a span can cross a year.
const RANGE_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { month: 'short', day: 'numeric', ...CLOCK, timeZoneName: 'short' },
  week: { month: 'short', day: 'numeric' },
  month: { month: 'short', day: 'numeric' },
  quarter: UTC_MONTH,
  year: UTC_MONTH,
};

// En dash, not an arrow: this is a span between two dates, and the arrow read as direction
const RANGE_SEPARATOR = ' \u2013 ';

// Locales already reported, so a bad prop does not log on every render
const warnedLocales = new Set<string>();

function formatterFor(
  locale: string,
  options: Intl.DateTimeFormatOptions
): (date: Dayjs) => string {
  const intl = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
  return (date) => intl.format(date.toDate());
}

// `formatRange` drops what the two ends share ('Jan 15 - 17'), which is the whole reason the
// readout uses it. It throws on a range that runs backwards - reachable by resizing an end
// past its own start - so that case falls back to printing both ends.
function rangeFormatterFor(
  intl: Intl.DateTimeFormat
): (start: Dayjs, end: Dayjs) => string {
  return (start, end) => {
    try {
      return intl.formatRange(start.toDate(), end.toDate());
    } catch {
      return joinRange(intl.format(start.toDate()), intl.format(end.toDate()));
    }
  };
}

function joinRange(start: string, end: string): string {
  return start === end ? start : `${start}${RANGE_SEPARATOR}${end}`;
}

// Intl has no quarter field: the number goes first for a year ending in a digit, last otherwise
// ('2025년 Q3'). Anything more idiomatic belongs in a `formats.quarter.header` override.
function quarterHeaderFor(locale: string): (date: Dayjs) => string {
  const year = formatterFor(locale, UTC_YEAR);
  return (date) => {
    const label = year(date);
    const quarter = `Q${quarterOfYear(date)}`;
    return /\d$/.test(label) ? `${quarter} ${label}` : `${label} ${quarter}`;
  };
}

// Only the week scale groups by week, and only when `firstDayOfWeek` is set
export function resolveLabelUnit(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttLabelUnit {
  if (scale === 'week' && options?.firstDayOfWeek !== undefined) return 'week';
  return GANTT_SCALE_CONFIG[scale].labelUnit;
}

// Builds Intl.DateTimeFormat instances, so callers memoize on [scale, options]
export function resolveFormatters(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttFormatters {
  const override = options?.formats?.[scale];

  // A week group needs a day-precise header: 'MMM YYYY' would label every week of a
  // month identically and merge them straight back together
  const headerScale = resolveLabelUnit(scale, options) === 'week' ? 'day' : scale;

  const config = GANTT_SCALE_CONFIG[scale];
  const headerConfig = GANTT_SCALE_CONFIG[headerScale];
  const intl = options?.locale
    ? localeFormatters(options.locale, scale, headerScale)
    : null;

  // The readout labels each end on its own, so `edge` is the primitive and `range` is two
  // edges joined. Both follow `tooltip` down the same three layers: an override formats an
  // end, a locale runs it through Intl, and the built-ins use the compact per-scale string.
  const overrideTooltip = override?.tooltip;
  const edge: GanttFormatters['edge'] =
    overrideTooltip ??
    intl?.edge ??
    ((date) => date.format(RANGE_FORMATS[scale]));

  // A locale merges what the two ends share ('Jan 15 - 17'); the other two layers can only
  // join what `edge` produced, collapsing to one label when both ends read alike.
  const range: GanttFormatters['range'] =
    !overrideTooltip && intl?.range
      ? intl.range
      : (start, end) => joinRange(edge(start), edge(end));

  return {
    edge,
    range,
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

// Intl.DateTimeFormat throws on a malformed tag ('en_US'), so return null to fall back to
// the built-in labels and report the tag once
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
      edge: formatterFor(locale, RANGE_OPTIONS[scale]),
      range: rangeFormatterFor(
        new Intl.DateTimeFormat(locale, {
          timeZone: 'UTC',
          ...RANGE_OPTIONS[scale],
        })
      ),
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
