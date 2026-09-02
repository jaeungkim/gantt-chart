`exportToPng` rasterizes the chart and hands back a PNG `Blob`. It lives on the ref handle, so
these three types describe its options and its date window. Import them from the package root.

```tsx
import type {
  GanttExportApi,
  GanttExportOptions,
  GanttExportRange,
} from '@jaeungkim/gantt-chart';
```

`GanttExportApi` is one of the three interfaces [`GanttHandle`](handle.md) extends, so the method is
reached through the `ref`. See [Imperative API](../imperative-api.md) for the calling pattern.

## GanttExportApi

```ts
/** Imperative export API */
export interface GanttExportApi {
  /**
   * Renders the whole chart to a PNG and resolves with the blob
   *
   * No download is triggered - what to do with the blob is the caller's choice
   * (save it, upload it, drop it into a PDF).
   */
  exportToPng: (options?: GanttExportOptions) => Promise<Blob>;
}
```

### Return value

`Promise<Blob>`. The blob's MIME type is `image/png`, produced by `canvas.toBlob(cb, 'image/png')`.
It is not a data URL, not an `<img>`, and not a download — nothing is written to disk and no anchor
is clicked.

The promise rejects with a plain `Error` whose message is always prefixed `exportToPng: `.

| Message | Condition |
|---|---|
| `no Gantt chart is mounted.` | the chart's scroll element is not in the ref |
| `the chart container is not in the DOM.` | the scroll element has no `.gantt-container` ancestor |
| `the chart has no timeline to export (no tasks).` | no header cells, or a timeline narrower than 1px |
| `the requested range does not overlap the chart's timeline.` | the resolved `range` is narrower than 1px |
| `timed out waiting for all N rows to render.` | 60 animation frames passed without every row in the DOM |
| `the chart has no content to export (no timeline is rendered).` | no `.gantt-content` element to clone |
| `the chart has no content to export.` | the measured clone is narrower or shorter than 1px |
| `the browser refused to rasterize the chart. This usually means the chart contains a resource the SVG renderer cannot inline.` | the serialized SVG failed to load as an image |
| `could not get a 2D canvas context.` | `getContext('2d')` returned `null` |
| `the canvas produced no PNG data.` | `toBlob` called back with `null` |
| `the canvas is tainted, so it cannot be read back. A cross-origin image or font reached the chart. (<error>)` | `toBlob` threw — a cross-origin image or font is in the chart. The thrown value is appended in parentheses |

The range is resolved before the chart enters export mode, so a bad `range` rejects without
disturbing what is on screen. Scroll position and virtualization are restored whether the capture
resolves or rejects.

## GanttExportOptions

```ts
/** Options for `GanttHandle.exportToPng` */
export interface GanttExportOptions {
  /**
   * Pixel density of the output (default 2)
   *
   * Lowered automatically when the resulting canvas would exceed the browser's
   * limits - a very wide timeline is downscaled rather than failing.
   */
  pixelRatio?: number;
  /** Background colour (any CSS colour). Defaults to the resolved theme background. */
  background?: string;
  /**
   * Clip the export to a date range
   *
   * Dates outside the timeline are clamped to its edges. Omit to export the
   * whole timeline.
   */
  range?: GanttExportRange;
}
```

| Option | Type | Unit | Default | Meaning |
|---|---|---|---|---|
| `pixelRatio` | `number` | device pixels per CSS pixel | `2` | Output density. Clamped down when the canvas would exceed the browser's limits. `0`, a negative number, and any non-finite number fall back to `1`. |
| `background` | `string` | any CSS colour | the computed `background-color` of `.gantt-container`, or `#ffffff` when that is empty, `transparent`, or `rgba(0, 0, 0, 0)` | Painted under the chart before it is drawn. |
| `range` | `GanttExportRange` | — | the whole timeline | Clips the output to a date window. |

The default background comes from `--gantt-background` on the container; see
[Theming](../theming.md) for that variable.

Final canvas size is `max(1, round(width × scale))` by `max(1, round(height × scale))` in device
pixels, where `scale` is `pixelRatio` after clamping.

## GanttExportRange

```ts
/** Date range the export is clipped to */
export interface GanttExportRange {
  from: string | Date | Dayjs;
  to: string | Date | Dayjs;
}
```

Both fields are required. Each value is passed through `dayjs()`, so a `Dayjs`, a `Date`, or any
string `dayjs` parses is accepted. `Dayjs` is dayjs's own type — it is not re-exported by this
package, so import it from `dayjs` if you need to name it.

| Case | Result |
|---|---|
| `range` omitted | the whole timeline is exported |
| `from` after `to` | accepted — the window is normalised, the earlier date wins |
| `from` before the start of the timeline | clamped to the timeline's left edge |
| `to` past the end of the timeline | clamped to the timeline's right edge |
| the window lies entirely outside the timeline | rejects with `does not overlap the chart's timeline.` |
| `range` given while the timeline has no header cells | ignored — the whole timeline is exported |

The overlap check runs on pixels, not dates. A window that resolves to less than 1px of timeline is
rejected as non-overlapping even when its dates sit inside the chart — a 30-minute window on the
`year` scale is one such case.

## Constraints

The capture serializes a detached clone of the chart into an SVG `foreignObject` and draws that onto
a canvas. That mechanism sets the limits below.

- Only whitelisted styles travel to the clone. 67 HTML properties and 15 SVG properties are copied
  off `getComputedStyle`. Anything outside those lists is absent from the PNG, including
  `background-position`, `background-size`, `background-repeat`, `text-decoration`, `filter`,
  `clip-path`, and `outline`. `background-image` is copied, but without those companions it renders
  at the initial position, size, and repeat. The whitelist keeps the serialized markup an order of
  magnitude smaller than a full computed-style dump.
- `display` is deliberately left out of the SVG list, so that forcing it onto a `<marker>` in
  `<defs>` cannot drop the dependency arrowheads.
- Pseudo-elements are not captured. `::before` and `::after` never appear — only real elements are
  walked.
- Only fonts the browser already has render. `foreignObject` rasterization cannot fetch a webfont.
  Text falls back to whatever the browser can resolve locally.
- A cross-origin image or font taints the canvas. `toBlob` then throws and the promise rejects with
  the taint error. Nothing in the bundled stylesheet loads a remote resource, so a taint comes from
  host-app content — a `renderBar` avatar, a logo in a custom column.
- Large charts are downscaled, never cropped. A canvas is capped at 16384px per side and
  268,435,456px of area; past either limit the browser produces a blank canvas with no error. The
  export lowers `pixelRatio` to stay under both. For a full-density slice of a very wide chart, pass
  a `range` instead of raising `pixelRatio`.
- Only the scroll container is captured. The toolbar, the scale selector, and the `aria-live` region
  sit outside it and are not in the image.
- The chart is exported as it stands. Virtualization is switched off for the capture, so every row
  and every header cell is rasterized. Collapse state is not: rows hidden under a collapsed parent
  or a collapsed group are not rendered, so a collapsed chart exports collapsed.
- The capture holds the whole chart in the DOM. For the frames it takes, every row and header cell
  is live, plus a full clone of that subtree. The row wait gives up after 60 animation frames.
- Nothing is fetched. The SVG is a `data:` URL built in memory, and no dependency is added for the
  export — `cloneNode`, `getComputedStyle`, `XMLSerializer`, `Image`, `<canvas>`, and
  `requestAnimationFrame` do all of it.
