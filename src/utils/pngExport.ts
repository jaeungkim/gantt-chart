import { Dayjs } from "dayjs";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import dayjs from "utils/dayjs";
import { calculateDateOffsetPx } from "utils/timeline";

/** Date range the export is clipped to */
export interface GanttExportRange {
  from: string | Date | Dayjs;
  to: string | Date | Dayjs;
}

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

/**
 * Canvas limits.
 *
 * Chrome caps a canvas at 16384px per side and roughly 268M pixels of area;
 * Firefox and Safari are in the same range. Going past either produces a blank
 * canvas with no error, so the scale is clamped instead.
 */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 268_435_456;

/**
 * Computed properties copied onto the clone.
 *
 * The clone is serialized on its own, with no stylesheet attached, so every
 * property that matters for a still picture has to travel inline. This is a
 * whitelist rather than the full ~350-property computed style: dumping
 * everything makes the serialized markup an order of magnitude larger and the
 * raster far slower, all for properties (transitions, cursors, scroll
 * behaviour) a still picture cannot use anyway.
 */
const HTML_STYLE_PROPERTIES = [
  "box-sizing",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "overflow-x",
  "overflow-y",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "justify-content",
  "row-gap",
  "column-gap",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "background-color",
  "background-image",
  "box-shadow",
  "opacity",
  "visibility",
  "z-index",
  "transform",
  "transform-origin",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-overflow",
  "white-space",
  "direction",
] as const;

/**
 * Properties copied onto elements inside an `<svg>` (the dependency arrows).
 *
 * Their layout comes from SVG geometry attributes, which the clone already
 * carries, so only paint properties are needed. `display` in particular is left
 * out: forcing it onto a `<marker>` in `<defs>` is a good way to lose the
 * arrowheads.
 */
const SVG_STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "opacity",
  "visibility",
  "color",
  "font-family",
  "font-size",
  "font-weight",
] as const;

/**
 * Largest scale factor that keeps the canvas inside the browser's limits
 *
 * Returns `pixelRatio` unchanged when it already fits. May return a value below
 * 1 for a timeline that is wider than the maximum canvas on its own.
 */
export function resolveCanvasScale(
  width: number,
  height: number,
  pixelRatio: number,
  maxSide: number = MAX_CANVAS_SIDE,
  maxArea: number = MAX_CANVAS_AREA
): number {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const requested =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;

  return Math.min(
    requested,
    maxSide / safeWidth,
    maxSide / safeHeight,
    Math.sqrt(maxArea / (safeWidth * safeHeight))
  );
}

/**
 * Px offset of a date along the timeline, clamped to the timeline's edges
 *
 * `calculateDateOffsetPx` returns null both before the start and after the end,
 * which the two ends have to be told apart for here.
 */
function clampedOffsetPx(
  date: Dayjs,
  cells: GanttBottomRowCell[],
  scale: GanttScaleKey,
  totalWidth: number
): number {
  if (date.valueOf() <= cells[0].startDate.valueOf()) return 0;
  return calculateDateOffsetPx(date, cells, scale) ?? totalWidth;
}

/**
 * Resolves the export's horizontal window in px
 *
 * With no range, the whole timeline. Throws when the requested range does not
 * overlap the timeline at all - an empty image is never what the caller wanted.
 */
export function resolveExportRangePx(
  range: GanttExportRange | undefined,
  cells: GanttBottomRowCell[],
  scale: GanttScaleKey,
  totalWidth: number
): { left: number; width: number } {
  if (!range || !cells.length) return { left: 0, width: totalWidth };

  const from = clampedOffsetPx(dayjs(range.from), cells, scale, totalWidth);
  const to = clampedOffsetPx(dayjs(range.to), cells, scale, totalWidth);

  const left = Math.min(from, to);
  const width = Math.abs(to - from);

  if (width < 1) {
    throw new Error(
      "exportToPng: the requested range does not overlap the chart's timeline."
    );
  }

  return { left, width };
}

/** Wraps serialized XHTML in an SVG `foreignObject` and returns it as a data URL */
export function toSvgDataUrl(
  markup: string,
  width: number,
  height: number
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">${markup}</foreignObject>` +
    `</svg>`;

  // encodeURIComponent rather than base64 - task names are arbitrary unicode
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Copies the computed styles of `source` onto `target`, recursing through both trees in step */
function inlineComputedStyles(
  source: Element,
  target: Element,
  properties: readonly string[]
): void {
  const computed = window.getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;

  for (const property of properties) {
    const value = computed.getPropertyValue(property);
    if (value) style.setProperty(property, value);
  }

  // Children of an <svg> only need paint properties; everything else needs the box model
  const childProperties =
    source instanceof SVGElement ? SVG_STYLE_PROPERTIES : HTML_STYLE_PROPERTIES;

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    inlineComputedStyles(
      sourceChildren[i],
      targetChildren[i],
      childProperties
    );
  }
}

/** Loads a data URL into an `Image`, rejecting with a readable error on failure */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "exportToPng: the browser refused to rasterize the chart. This usually means the chart contains a resource the SVG renderer cannot inline."
        )
      );
    image.src = url;
  });
}

/** Waits one animation frame */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export interface CaptureParams {
  /** Left edge of the exported window, in timeline px */
  left: number;
  /** Width of the exported window, in timeline px */
  width: number;
  background: string;
  pixelRatio: number;
}

/**
 * Rasterizes the scroll container's full content to a PNG blob
 *
 * The chart is DOM, not canvas, so it is captured by cloning the subtree,
 * inlining the computed styles it actually uses, and handing the result to the
 * browser's own renderer through `<svg><foreignObject>`. The clone is never
 * attached to the document, so the live chart is untouched.
 *
 * The caller is responsible for having every row, arrow and header cell
 * rendered before this runs - a virtualized chart only holds the visible slice.
 */
export async function captureScrollContainer(
  scrollEl: HTMLElement,
  { left, width, background, pixelRatio }: CaptureParams
): Promise<Blob> {
  const headerEl = scrollEl.querySelector<HTMLElement>(".gantt-header-wrapper");
  const contentEl = scrollEl.querySelector<HTMLElement>(".gantt-content");
  if (!contentEl) {
    throw new Error(
      "exportToPng: the chart has no content to export (no timeline is rendered)."
    );
  }

  const fullWidth = contentEl.offsetWidth;
  const height = (headerEl?.offsetHeight ?? 0) + contentEl.offsetHeight;
  if (fullWidth < 1 || height < 1) {
    throw new Error("exportToPng: the chart has no content to export.");
  }

  const clone = scrollEl.cloneNode(true) as HTMLElement;
  inlineComputedStyles(scrollEl, clone, HTML_STYLE_PROPERTIES);

  // The clone renders as one full-size block: no scrolling, shifted left so the
  // requested range lands at x=0
  clone.style.setProperty("width", `${fullWidth}px`);
  clone.style.setProperty("height", `${height}px`);
  clone.style.setProperty("overflow", "visible");
  clone.style.setProperty("margin", `0 0 0 ${-left}px`);

  const frame = document.createElement("div");
  frame.setAttribute(
    "style",
    `box-sizing:border-box;width:${width}px;height:${height}px;` +
      `overflow:hidden;background:${background};`
  );
  frame.appendChild(clone);

  const url = toSvgDataUrl(
    new XMLSerializer().serializeToString(frame),
    width,
    height
  );
  const image = await loadImage(url);

  const scale = resolveCanvasScale(width, height, pixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("exportToPng: could not get a 2D canvas context.");
  }

  // foreignObject content is transparent where nothing is painted, so the
  // background is filled first - otherwise a dark-theme export comes out clear
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("exportToPng: the canvas produced no PNG data."));
      }, "image/png");
    } catch (error) {
      reject(
        new Error(
          `exportToPng: the canvas is tainted, so it cannot be read back. A cross-origin image or font reached the chart. (${String(error)})`
        )
      );
    }
  });
}
