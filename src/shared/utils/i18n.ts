import { DATE_FORMATS, GANTT_SCALE_CONFIG, RANGE_FORMATS } from 'shared/constants';
import { Dayjs } from 'dayjs';
import {
  GanttFormatters,
  GanttLabelUnit,
  GanttLocaleOptions,
  GanttScaleKey,
} from 'shared/types';
import { quarterOfYear } from 'core/dates';

const UTC_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};
const UTC_MONTH: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short' };
const UTC_YEAR: Intl.DateTimeFormatOptions = { year: 'numeric' };
const CLOCK: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

const TICK_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { hour: '2-digit', hourCycle: 'h23' },
  week: { day: 'numeric' },
  month: { month: 'short', day: 'numeric' },
  quarter: { month: 'short' },
  year: { month: 'short' },
};

const HEADER_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: UTC_DATE,
  week: UTC_MONTH,
  month: UTC_MONTH,
  quarter: UTC_YEAR,
  year: UTC_YEAR,
};

const TOOLTIP_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { ...UTC_DATE, ...CLOCK, timeZoneName: 'short' },
  week: UTC_DATE,
  month: UTC_DATE,
  quarter: UTC_MONTH,
  year: UTC_MONTH,
};

const RANGE_OPTIONS: Record<GanttScaleKey, Intl.DateTimeFormatOptions> = {
  day: { ...CLOCK, timeZoneName: 'short' },
  week: { month: 'short', day: 'numeric' },
  month: { month: 'short', day: 'numeric' },
  quarter: UTC_MONTH,
  year: UTC_MONTH,
};

const RANGE_SEPARATOR = ' \u2013 ';

const warnedLocales = new Set<string>();

function formatWith(intl: Intl.DateTimeFormat, date: Dayjs): string {
  return date.isValid() ? intl.format(date.toDate()) : date.format();
}

function formatterFor(
  locale: string,
  options: Intl.DateTimeFormatOptions
): (date: Dayjs) => string {
  const intl = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
  return (date) => formatWith(intl, date);
}

function rangeFormatterFor(
  locale: string,
  options: Intl.DateTimeFormatOptions
): (start: Dayjs, end: Dayjs) => string {
  const intl = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
  return (start, end) => {
    try {
      return intl.formatRange(start.toDate(), end.toDate());
    } catch {
      return joinRange(formatWith(intl, start), formatWith(intl, end));
    }
  };
}

function joinRange(start: string, end: string): string {
  return start === end ? start : `${start}${RANGE_SEPARATOR}${end}`;
}

function quarterHeaderFor(locale: string): (date: Dayjs) => string {
  const year = formatterFor(locale, UTC_YEAR);
  return (date) => {
    const label = year(date);
    const quarter = `Q${quarterOfYear(date)}`;
    return /\d$/.test(label) ? `${quarter} ${label}` : `${label} ${quarter}`;
  };
}

export function resolveLabelUnit(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttLabelUnit {
  if (scale === 'week' && options?.firstDayOfWeek !== undefined) return 'week';
  return GANTT_SCALE_CONFIG[scale].labelUnit;
}

export function resolveFormatters(
  scale: GanttScaleKey,
  options?: GanttLocaleOptions
): GanttFormatters {
  const override = options?.formats?.[scale];

  const headerScale = resolveLabelUnit(scale, options) === 'week' ? 'day' : scale;

  const config = GANTT_SCALE_CONFIG[scale];
  const headerConfig = GANTT_SCALE_CONFIG[headerScale];
  const intl = options?.locale
    ? localeFormatters(options.locale, scale, headerScale)
    : null;

  const overrideTooltip = override?.tooltip;
  const edge: GanttFormatters['edge'] =
    overrideTooltip ??
    intl?.edge ??
    ((date) => date.format(RANGE_FORMATS[scale]));

  const range: GanttFormatters['range'] =
    !overrideTooltip && intl?.range
      ? intl.range
      : (start, end) => joinRange(edge(start), edge(end));

  return {
    edge,
    range,
    tick: override?.tick ?? intl?.tick ?? config.formatTickLabel,
    header: override?.header ?? intl?.header ?? headerConfig.formatHeaderLabel,
    tooltip:
      overrideTooltip ??
      intl?.tooltip ??
      ((date) => date.format(DATE_FORMATS[scale])),
  };
}

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
      range: rangeFormatterFor(locale, RANGE_OPTIONS[scale]),
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

export function formatDuration(durationMs: number): string {
  const hours = Math.max(0, Math.round(durationMs / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}
