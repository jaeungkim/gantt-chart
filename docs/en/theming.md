You render the chart and get a column of unpositioned divs with no colors. The stylesheet is a
separate file, and importing the component does not pull it in. Once it is loaded the chart is
themed by 33 CSS custom properties and one `theme` prop.

Nearly every color, shadow and transition in the chart reads a `--gantt-*` variable; the four
that do not are named under Limits. There is no theme object in JS and no `tokens` prop. CSS is
the whole mechanism.

## The stylesheet

The package exports the built CSS under its own subpath.

```tsx
// src/main.tsx
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';
```

That subpath resolves to `dist/gantt-chart.css`. The package entry does import the stylesheet,
but the library build emits it as that separate file instead of inlining it, so importing the
component pulls in no styles.

Without the import the chart still mounts and still responds to clicks. It has no styles at all:
no token declarations, no colors, and none of the layout rules. Sticky headers, the bar geometry,
the flex column of the container and the `box-sizing: border-box` the layout math assumes all live
in that file. The result is unreadable rather than merely plain.

`box-sizing` is scoped to `.gantt-container` and its descendants. The library ships no global
reset, so the file is safe to import into an app that has its own.

## The theme prop

`theme` takes `'light'`, `'dark'` or `'system'`. It is optional.

```tsx
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  { id: 'spec', name: 'Spec', parentId: null, sequence: '1',
    startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-06T00:00:00Z' },
];

export function DarkChart() {
  return <ReactGanttChart tasks={tasks} theme="dark" height={480} />;
}
```

What lands on the container element:

| `theme` | Container class | `data-theme` |
|---|---|---|
| *(omitted)* | `gantt-container` | *absent* |
| `'light'` | `gantt-container light` | `"light"` |
| `'dark'` | `gantt-container dark` | `"dark"` |
| `'system'`, OS light | `gantt-container light` | `"light"` |
| `'system'`, OS dark | `gantt-container dark` | `"dark"` |
| `'system'`, server render and first hydration render | `gantt-container` | *absent* |
| `'system'`, no `window.matchMedia` | `gantt-container` | *absent* |

Both the class and the attribute are written, so a host can hook its own CSS onto either one.

`className` is folded in ahead of the theme class. With `className="my-chart"` and `theme="dark"`
the attribute reads `gantt-container my-chart dark`. A host class is never last, so do not write
selectors that assume it is.

### How system is detected

`theme="system"` reads `window.matchMedia('(prefers-color-scheme: dark)')` through
`useSyncExternalStore`. A `change` listener stays attached, so flipping the OS appearance swaps
the class on the next render. No reload is needed.

The server snapshot is fixed at "unknown". On a server render and on the first hydration render
`theme="system"` therefore emits no class and no attribute, deliberately, to avoid a hydration
mismatch. The chart still looks correct on that first paint, because the stylesheet carries its
own `prefers-color-scheme` fallback. A host reading `data-theme` in a `useLayoutEffect` will read
`undefined` on that first pass.

The media query is subscribed to whatever `theme` is set to, including `'light'` and `'dark'`.
The listener exists per chart instance; it does not change the resolved value.

### With no theme prop

Omitting `theme` is not the same as `theme="light"`. With no prop the component emits nothing,
and the stylesheet follows the OS on its own:

```css
@media (prefers-color-scheme: dark) {
  .gantt-container:not(.light):not([data-theme="light"]) { /* dark tokens */ }
}
```

So an unthemed chart goes dark on a dark-OS machine. To pin a chart to light regardless of the
OS, pass `theme="light"` — that is the only thing the `light` class does. It carries no tokens of
its own; light is the base `.gantt-container` declaration.

## The custom properties

All 33 tokens are declared on `.gantt-container`, never on `:root`. On `:root` they would collide
with a host app's own `--background` and `--border`.

28 of them are redefined for dark. The other 5 are shared by both themes and are marked with a
dash below.

### Surface and text

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-background` | `#fafafa` | `#09090b` | container, toolbar, grid pane, grid header, top header groups, content area; active scale-button fill; link-handle and progress-handle fill; tooltip text |
| `--gantt-foreground` | `#18181b` | `#fafafa` | body text, grid cells, top group label, bar labels rendered outside the bar, milestone name, bar tooltip background |
| `--gantt-muted` | `#f4f4f5` | `#18181b` | bottom header row, scale-control track, row hover and selection, swimlane group rows |
| `--gantt-muted-foreground` | `#71717a` | `#a1a1aa` | secondary text (grid header cells, tick labels, band labels, group-count pill), bar resize grips, scrollbar thumb hover |
| `--gantt-border` | `#e4e4e7` | `#27272a` | toolbar, header and grid borders, scrollbar thumb, expander hover fill |
| `--gantt-border-subtle` | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.04)` | row separators, the line between the two header rows |
| `--gantt-accent` | `#3b82f6` | — | every focus ring, selected-row inset bar, row-drop line, drag guides, selected or hovered dependency arrow, link handle border, link preview, draw-to-create ghost |

### Bars, milestones and summary rows

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-bar-bg` | `#e4e4e7` | `#27272a` | `.gantt-task-bar` background |
| `--gantt-bar-bg-hover` | `#d4d4d8` | `#3f3f46` | its hover |
| `--gantt-bar-text` | `#18181b` | `#fafafa` | the task name inside a bar |
| `--gantt-bar-shadow` | `0 1px 2px rgba(0, 0, 0, 0.05)` | `0 1px 2px rgba(0, 0, 0, 0.2)` | resting bar and milestone diamond |
| `--gantt-bar-shadow-hover` | `0 4px 12px rgba(0, 0, 0, 0.1)` | `0 4px 12px rgba(0, 0, 0, 0.3)` | hovered bar and diamond |
| `--gantt-bar-shadow-drag` | `0 8px 24px rgba(0, 0, 0, 0.15)` | `0 8px 24px rgba(0, 0, 0, 0.4)` | a bar or diamond being dragged |
| `--gantt-milestone-bg` | `#52525b` | `#d4d4d8` | milestone diamond **and** summary-row bar |
| `--gantt-milestone-bg-hover` | `#3f3f46` | `#e4e4e7` | the hover of both |

One token paints milestones and summary rows together. There is no way to color them
independently through CSS.

### Progress and baseline

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-progress-bg` | `#a1a1aa` | `#52525b` | the progress fill inside a bar |
| `--gantt-progress-handle` | `#52525b` | `#a1a1aa` | the progress handle border; its fill is `--gantt-background` |
| `--gantt-baseline-bg` | `#a1a1aa` | `#71717a` | the baseline strip under a bar |

### Critical path

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-critical` | `#dc2626` | `#f87171` | critical progress fill, critical milestone diamond, critical arrow stroke and head |
| `--gantt-critical-bg` | `#fecaca` | `#7f1d1d` | a critical bar's background |
| `--gantt-critical-bg-hover` | `#fca5a5` | `#991b1b` | its hover |
| `--gantt-critical-text` | `#7f1d1d` | `#fee2e2` | a critical bar's label, inside the bar only; an outside label falls back to `--gantt-foreground` |

### Dependency arrows

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-arrow` | `#a1a1aa` | `#71717a` | arrow stroke and arrowhead fill |

A selected or hovered arrow switches to `--gantt-accent`, and an arrow on the critical path to
`--gantt-critical`.

### Markers, bands and the today line

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-today-marker` | `#f43f5e` | `#fb7185` | the today line, **and** every invalid-state color: rejected row-drop targets, rejected link previews, rejected link targets |
| `--gantt-marker` | `#6366f1` | `#818cf8` | a marker line and its label background |
| `--gantt-marker-warning` | `#f59e0b` | `#fbbf24` | a marker with `data-warning="true"` |
| `--gantt-marker-label` | `#ffffff` | `#18181b` | the marker label text |
| `--gantt-band-bg` | `rgba(99, 102, 241, 0.1)` | `rgba(129, 140, 248, 0.16)` | a range band's fill |

### Non-working days

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-non-working-bg` | `rgba(0, 0, 0, 0.035)` | `rgba(255, 255, 255, 0.03)` | the shaded weekend and holiday columns |

Which days get shaded is decided by `showNonWorkingDays`, `holidays` and `isNonWorkingDay` — see
[The timeline](timeline.md).

### Typography and motion

| Token | Light | Dark | Paints |
|---|---|---|---|
| `--gantt-font-sans` | `-apple-system, BlinkMacSystemFont, "Segoe UI", "Geist", system-ui, sans-serif` | — | the container's `font-family` |
| `--gantt-duration-fast` | `150ms` | — | the bar tooltip's fade-in only; it is duration-only because the transition tokens carry easing, which an `animation` shorthand rejects |
| `--gantt-transition-fast` | `150ms ease` | — | color and background transitions on bars, buttons, toggles, handles |
| `--gantt-transition-normal` | `200ms ease` | — | box-shadow transitions and the revert animation |

No remote font is loaded anywhere in the stylesheet. The base font size is `13px` and is not
tokenized.

Under `@media (prefers-reduced-motion: reduce)` every transition and animation inside the
container is forced to `0.01ms`, and `scroll-behavior` to `auto`. That happens whatever the motion
tokens are set to.

## Overriding a token

Write the override on `.gantt-container` and load your stylesheet after the library's. Your rule
and the library's base rule have the same specificity, so source order is what decides.

```css
/* app.css - imported after @jaeungkim/gantt-chart/style.css */
.gantt-container {
  --gantt-font-sans: "Inter", system-ui, sans-serif;
}
```

That is enough for the 5 tokens the dark blocks never touch: `--gantt-font-sans`,
`--gantt-accent`, and the three motion tokens. For the other 28 it is not.

> [!WARNING]
> A one-line override on `.gantt-container` wins in light mode and loses in dark. The library's
> dark rule is `.gantt-container.dark, .gantt-container[data-theme="dark"]` at specificity
> `(0,2,0)`, and its OS fallback is `.gantt-container:not(.light):not([data-theme="light"])` at
> `(0,3,0)`. A plain `.gantt-container` rule is `(0,1,0)` and is outranked by both.

To change a themed token you have to answer all three of the library's selectors.

```css
/* app.css - imported after @jaeungkim/gantt-chart/style.css */
.gantt-container {
  --gantt-bar-bg: #dbeafe;
  --gantt-bar-bg-hover: #bfdbfe;
}

.gantt-container.dark,
.gantt-container[data-theme="dark"] {
  --gantt-bar-bg: #1e3a5f;
  --gantt-bar-bg-hover: #2b4f7d;
}

@media (prefers-color-scheme: dark) {
  .gantt-container:not(.light):not([data-theme="light"]) {
    --gantt-bar-bg: #1e3a5f;
    --gantt-bar-bg-hover: #2b4f7d;
  }
}
```

Setting the tokens on `:root` does nothing. They are declared on `.gantt-container` itself, and a
declaration on the element beats anything inherited from an ancestor.

### Scoping to one chart

Pass a `className` and qualify every selector with it. Each qualified selector gains one class
over the library's, so it outranks the block it mirrors.

```tsx
<ReactGanttChart tasks={tasks} className="planning-chart" height={480} />
```

```css
/* app.css - imported after @jaeungkim/gantt-chart/style.css */
.gantt-container.planning-chart {
  --gantt-bar-bg: #dbeafe;
}

.gantt-container.planning-chart.dark,
.gantt-container.planning-chart[data-theme="dark"] {
  --gantt-bar-bg: #1e3a5f;
}

@media (prefers-color-scheme: dark) {
  .gantt-container.planning-chart:not(.light):not([data-theme="light"]) {
    --gantt-bar-bg: #1e3a5f;
  }
}
```

### Per-task color wins over the tokens

A task's own `color` is written as an inline `--gantt-bar-color` on that bar, which the bar reads
ahead of the theme tokens, so a colored task ignores them entirely — see
[Custom rendering](custom-rendering.md).

## Remembering the scale

The selected scale is persisted so a reload does not throw the user back to the month view.

Storage is `sessionStorage`, not `localStorage`. It is cleared when the tab closes. The default
key is `"gantt-scale"`, and `storageKey` changes it.

```tsx
<ReactGanttChart tasks={tasks} storageKey="roadmap-scale" defaultScale="week" height={480} />
```

Four paths write: the segmented control, the arrow keys on it, the Ctrl/Cmd + wheel zoom gesture,
and the mount-time restore itself. A repeat selection of the current scale writes nothing. Nothing
else in the chart touches storage — not drag frames, not the grid width, not collapsed rows, not
the scroll position.

On mount the order is: a value stored for this session, then `defaultScale`, then `"month"`. A
stored value that is not one of the six scale keys is discarded.

Some consequences worth knowing before you pick a key:

- **`defaultScale` goes sticky after the first mount.** Any value other than `"month"` is written
  to storage on mount, so the next mount reads it back from storage instead. Changing the prop
  later then appears to do nothing.
- **Two charts sharing a key do not sync.** Each chart owns its state, and no `storage` event is
  listened for. Changing the scale in one chart does not move the other. The collision only shows
  up the next time a chart mounts and reads the key. Give each chart its own `storageKey`.
- **`storageKey` is read once.** It is captured when the chart mounts. Changing it afterwards has
  no effect for the life of that chart.
- **Unusable storage is silent.** Server rendering, private mode and a blocked-storage browser all
  make the read return nothing and the write a no-op. The scale still changes in memory, and
  nothing throws or warns.
- **The first frame is always `"month"`.** The restore runs in an effect, so a chart with
  `defaultScale="year"` paints one frame at month scale first.

The scale keys themselves, and what each one renders, are covered in
[The timeline](timeline.md).

## Limits

What theming does not cover:

- **No JS theme API.** There is no `tokens` prop, no theme object, and no exported default
  palette. `GanttTheme` is the three-value union and nothing else.
- **Four colors are hardcoded and cannot be themed.** The active scale button's shadow
  (`0 1px 3px rgba(0, 0, 0, 0.08)`), the drag guide label text (`#fff`), the dependency delete
  glyph stroke (`#fff`), and the bar tooltip's shadow (`0 4px 16px rgba(0, 0, 0, 0.15)`).
- **Geometry is not tokenized.** The top header row is `44px`, the bottom row `28px`, the base
  font size `13px`, and the row height is a JS constant. None of them are variables.
- **`--top-group-inset` is out of reach.** It is declared on `.gantt-top-group`, not on the
  container, and it carries no `--gantt-` prefix. A host cannot set it from `.gantt-container`.
- **No light-mode token block exists.** The `light` class only suppresses the OS media query, so
  a host rule written as `.gantt-container.light { … }` is a new rule, not an extension of one.
- **No provider.** `theme` is a per-chart prop. Nothing sets it once for a page, so every chart
  on a page has to be passed the value.
- **The theme is not persisted.** Nothing stores the resolved theme. Only the scale is persisted,
  and only for the session.
- **No RTL.** Nothing reads or sets `dir`, and the stylesheet uses physical properties throughout.
- **Nothing is validated.** An unknown `theme` value or an empty `storageKey` produces no warning.

What the host app does itself:

- Import `@jaeungkim/gantt-chart/style.css`, and import it before its own stylesheet.
- Repeat every themed override under all three of the library's selectors.
- Hardcode the string `"gantt-scale"` when clearing the default key by hand. The constant is not
  exported.
- Give each chart on a page its own `storageKey`.
- Drive `theme` from its own light/dark state if the app has a toggle. The chart reads the OS, not
  the app.
- Replace a bar entirely with `renderBar` when a token cannot express the change — see
  [Custom rendering](custom-rendering.md).

The one thing outside CSS that follows the theme is PNG export, which takes its background from
the container's computed background color — see [Imperative API](imperative-api.md).

Next: [Headless core](headless-core.md) covers the scheduling, graph and calendar functions that
run without React.
