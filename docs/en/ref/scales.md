Four types describe how the timeline is measured and how the chart is painted: `GanttScaleKey`
names one of the six scales, `GanttScaleFormat` and `GanttFormatOverrides` replace the labels
of a scale, and `GanttTheme` picks the palette. All four are exported from the package root.

```tsx
import type {
  GanttScaleKey,
  GanttScaleFormat,
  GanttFormatOverrides,
  GanttTheme,
} from '@jaeungkim/gantt-chart';
```

## GanttScaleKey

```ts
export type GanttScaleKey =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';
```

The declaration order is the order the scale selector lists them in — finest first. It is also the
ladder a wheel zoom steps along. `defaultScale` takes one of these values and defaults to `'month'`.

The key appears in several other shapes: `formats` is keyed by it, and `GanttBarRenderProps.scale`,
`GanttTooltipRenderProps.scale` and `GanttHeaderCellRenderProps.scale` all carry it. See
[Renderers](renderers.md).

### Per-scale configuration

Each key maps to one row of a fixed table. The row decides what the header cells say, how much time
one tick covers, and how many pixels one drag step is worth.

| scale | `labelUnit` | `tickUnit` | `unitPerTick` | `dragStepUnit` | `dragStepAmount` | `basePxPerDragStep` |
|---|---|---|---:|---|---:|---:|
| `hour` | `day` | `hour` | 1 | `minute` | 15 | 30 |
| `day` | `day` | `hour` | 1 | `hour` | 1 | 32 |
| `week` | `month` | `day` | 1 | `hour` | 6 | 54 |
| `month` | `month` | `day` | 1 | `day` | 1 | 32 |
| `quarter` | `quarter` | `month` | 1 | `day` | 3 | 24 |
| `year` | `year` | `month` | 1 | `day` | 7 | 28 |

The shape of one row:

```ts
export interface GanttScaleConfig {
  labelUnit: GanttLabelUnit;
  tickUnit: 'minute' | 'hour' | 'day' | 'week' | 'month';
  unitPerTick: number;

  dragStepUnit: 'minute' | 'hour' | 'day' | 'week';
  dragStepAmount: number;

  basePxPerDragStep: number;

  formatTickLabel?: (date: Dayjs) => string;
  formatHeaderLabel?: (date: Dayjs) => string;
}
```

```ts
/** Unit the top header row groups by ('quarter' has no dayjs equivalent - see core/dates) */
export type GanttLabelUnit =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';
```

`GanttScaleConfig`, `GanttLabelUnit` and the `GANTT_SCALE_CONFIG` object itself are **not exported
from the package** — they are module-internal. The table above cannot be imported, extended or
replaced, and no prop adds a seventh scale. Tick widths are derived from
`basePxPerDragStep / dragStepAmount`; see [The timeline](../timeline.md) for the arithmetic and
[Editing tasks](../editing.md) for the drag grid the same two fields define.

### Built-in labels

`formatTickLabel` and `formatHeaderLabel` are the last layer of the label chain — what renders when
no `formats` override and no `locale` applies.

| scale | `formatTickLabel` | `formatHeaderLabel` | tooltip format string |
|---|---|---|---|
| `hour` | `d.format('HH:mm')` | `d.format('MMM D, YYYY')` | `'MMM D, YYYY HH:mm [UTC]'` |
| `day` | `d.format('HH')` | `d.format('MMM D, YYYY')` | `'MMM D, YYYY HH:mm [UTC]'` |
| `week` | `d.format('D')` | `d.format('MMM YYYY')` | `'MMM D, YYYY'` |
| `month` | `d.format('D')` | `d.format('MMM YYYY')` | `'MMM D, YYYY'` |
| `quarter` | `d.format('MMM')` | `` `Q${quarterOfYear(d)} ${d.format('YYYY')}` `` | `'MMM YYYY'` |
| `year` | `d.format('MMM')` | `d.format('YYYY')` | `'MMM YYYY'` |

The tooltip strings live in a separate `DATE_FORMATS` constant, also not exported. `[UTC]` in the
hour and day strings is a dayjs escaped literal, not a resolved zone name.

## GanttScaleFormat

```ts
/**
 * Replaces the generated labels of one scale
 * Every entry is optional - whatever is left out keeps the built-in (or locale) label
 */
export interface GanttScaleFormat {
  /** Bottom header row - one label per tick */
  tick?: (date: Dayjs) => string;
  /** Top header row - one label per group */
  header?: (date: Dayjs) => string;
  /** Drag tooltip and drag guide label */
  tooltip?: (date: Dayjs) => string;
}
```

| Field | Type | Required | Applies to |
|---|---|---|---|
| `tick` | `(date: Dayjs) => string` | no | one label per tick, bottom header row |
| `header` | `(date: Dayjs) => string` | no | one label per group, top header row |
| `tooltip` | `(date: Dayjs) => string` | no | the bar drag tooltip and the drag guide labels |

The three are resolved independently, so supplying `header` alone leaves `tick` and `tooltip` on
whatever the `locale` or the built-in labels produce.

## GanttFormatOverrides

```ts
/** Per-scale label overrides, e.g. `{ quarter: { header: (d) => ... } }` */
export type GanttFormatOverrides = Partial<
  Record<GanttScaleKey, GanttScaleFormat>
>;
```

This is the type of the `formats` prop. A scale left out of the record keeps its resolved labels
whole.

```tsx
// QuarterHeader.tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { GanttFormatOverrides, Task } from '@jaeungkim/gantt-chart';

const formats: GanttFormatOverrides = {
  quarter: {
    header: (d) => `${d.year()} Q${Math.floor(d.month() / 3) + 1}`,
  },
  month: {
    tooltip: (d) => d.format('YYYY-MM-DD'),
  },
};

const tasks: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-01-05',
    endDate: '2026-02-20',
    parentId: null,
    sequence: '1',
  },
];

export default function QuarterHeader() {
  return <ReactGanttChart tasks={tasks} formats={formats} locale="en-US" />;
}
```

`formats` is declared at module scope here on purpose — see the note on identity below.

Which layer wins for each of the three labels is documented in
[Locale and date formats](../i18n.md).

## GanttTheme

```ts
/** Theme type - 'light', 'dark', or 'system' (follows the OS setting) */
export type GanttTheme = 'light' | 'dark' | 'system';
```

This is the type of the `theme` prop, which has no default. What each value puts on the chart's
container element:

| `theme` | container class | `data-theme` |
|---|---|---|
| *(omitted)* | `gantt-container` | absent |
| `'light'` | `gantt-container light` | `"light"` |
| `'dark'` | `gantt-container dark` | `"dark"` |
| `'system'`, OS light | `gantt-container light` | `"light"` |
| `'system'`, OS dark | `gantt-container dark` | `"dark"` |
| `'system'`, server render and first hydration render | `gantt-container` | absent |
| `'system'`, no `window.matchMedia` | `gantt-container` | absent |

`'system'` reads `(prefers-color-scheme: dark)` and re-renders on OS changes; no reload is needed.
Omitting `theme` also follows the OS, but through a `prefers-color-scheme` rule in the stylesheet
rather than through JavaScript — so the container carries no class either way. The palette those
classes select is in [Theming](../theming.md).

There is no theme object and no token prop. `GanttTheme` is a three-value union; every color is a
CSS custom property.

## Notes

- **Every `Dayjs` handed to a `tick`, `header` or `tooltip` function is a `dayjs.utc()` instance.**
  The chart parses, positions and labels every date in UTC. Inside an override, `d.format('HH:mm')`,
  `d.year()`, `d.month()` and `d.day()` therefore read UTC wall-clock values, not the viewer's local
  ones. A formatter that converts to local time will print labels that disagree with the cell they
  sit in.
- `header` receives the **group's start date**, not the first visible cell's date. On a week scale
  grouped from Monday, a group whose first rendered cell is `2025-08-31` is labelled with
  `2025-08-25T00:00:00Z`.
- `formats` is keyed by the scale being rendered, never by a derived unit. On the `week` scale with
  `firstDayOfWeek` set, the header is built from day-scale options but the override is still read
  from `formats.week.header`; `formats.day.header` does nothing there.
- The `formats` object must be memoized or module-scoped. A new object identity on every render
  invalidates the label memos, and with `locale` also set it rebuilds every `Intl.DateTimeFormat`
  instance. Nothing warns.
- `GanttScaleFormat` functions must return a `string`. There is no `ReactNode` escape hatch here —
  to render markup in a header cell, use `renderHeaderCell` ([Renderers](renderers.md)).
- Adjacent top-row groups that format to the **same string** merge into one cell. A `header`
  override returning a constant collapses the entire top row.
- The chart's UTC `dayjs` instance is not exported from the package. Import `dayjs` and its `utc`
  plugin directly if an override needs the same instance.
