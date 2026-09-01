import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { GanttRangeExtension, GanttScaleKey } from 'types/gantt';

/**
 * The zoom ladder, finest first
 *
 * Declaration order in GANTT_SCALE_CONFIG is the ladder - the scale selector lists the
 * scales in the same order, so a wheel step and an arrow key move the same way.
 */
export const SCALE_LADDER = Object.keys(GANTT_SCALE_CONFIG) as GanttScaleKey[];

/** Milliseconds in each unit a drag step can be expressed in */
const MS_PER_UNIT: Record<'minute' | 'hour' | 'day' | 'week', number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

/**
 * Roughly how many px one millisecond takes at a scale
 *
 * Exact for every scale whose ticks are a fixed duration, and close enough for the
 * month-tick scales (a month is 28-31 days), which is all `fitScale` needs.
 */
export function pxPerMs(scale: GanttScaleKey): number {
  const { basePxPerDragStep, dragStepUnit, dragStepAmount } =
    GANTT_SCALE_CONFIG[scale];
  return basePxPerDragStep / (dragStepAmount * MS_PER_UNIT[dragStepUnit]);
}

/** Moves `direction` places along the ladder (negative = finer), clamped at both ends */
export function stepScale(
  scale: GanttScaleKey,
  direction: number
): GanttScaleKey {
  const index = SCALE_LADDER.indexOf(scale);
  if (index === -1) return scale;

  const next = Math.min(
    SCALE_LADDER.length - 1,
    Math.max(0, index + direction)
  );
  return SCALE_LADDER[next];
}

/**
 * Finest scale at which `durationMs` still fits in `viewportPx`
 *
 * Falls back to the coarsest scale when even that is too narrow - a project that does not
 * fit anywhere is shown as wide as the ladder goes rather than not zoomed at all.
 */
export function fitScale(
  durationMs: number,
  viewportPx: number
): GanttScaleKey {
  for (const scale of SCALE_LADDER) {
    if (durationMs * pxPerMs(scale) <= viewportPx) return scale;
  }
  return SCALE_LADDER[SCALE_LADDER.length - 1];
}

/** Accumulated wheel delta that makes one scale step */
const ZOOM_DELTA_THRESHOLD = 24;
/** A gap this long in the wheel stream ends the gesture */
const ZOOM_GESTURE_GAP_MS = 120;

export interface ZoomAccumulator {
  /** Wheel delta collected during this gesture */
  delta: number;
  /** Timestamp of the last wheel event */
  lastEventAt: number;
  /** This gesture has already produced its step - the next pause unlocks it */
  locked: boolean;
}

export const INITIAL_ZOOM_ACCUMULATOR: ZoomAccumulator = {
  delta: 0,
  lastEventAt: 0,
  locked: false,
};

/**
 * Folds one wheel delta into the accumulator and reports whether it makes a scale step
 *
 * `step` is -1 (finer), 0 (nothing yet) or 1 (coarser). Small trackpad deltas add up until
 * they reach the threshold, and once a gesture has stepped, everything else it fires is
 * swallowed until the stream pauses - so a pinch that runs for half a second is one scale
 * step, not five, while two deliberate flicks are still two.
 */
export function accumulateZoom(
  state: ZoomAccumulator,
  deltaY: number,
  now: number
): { state: ZoomAccumulator; step: number } {
  // A pause ends the gesture: what was collected is stale, and stepping is possible again
  const paused = now - state.lastEventAt >= ZOOM_GESTURE_GAP_MS;

  if (!paused && state.locked) {
    return { state: { delta: 0, lastEventAt: now, locked: true }, step: 0 };
  }

  const delta = (paused ? 0 : state.delta) + deltaY;

  if (Math.abs(delta) < ZOOM_DELTA_THRESHOLD) {
    return { state: { delta, lastEventAt: now, locked: false }, step: 0 };
  }

  // Wheel down (positive delta) zooms out, the way the browser's own ctrl+wheel does
  return {
    state: { delta: 0, lastEventAt: now, locked: true },
    step: Math.sign(delta),
  };
}

/** How close to the edge a drag has to get before the timeline starts scrolling (px) */
export const EDGE_SCROLL_THRESHOLD = 48;
/** Fastest the timeline scrolls itself, at the very edge (px per frame) */
export const EDGE_SCROLL_MAX_SPEED = 22;

/**
 * Auto-scroll speed for a pointer at `clientX`, in px per frame
 *
 * 0 while the pointer is away from the edges, then ramps linearly to `maxSpeed` at the
 * edge itself, so a drag creeps at the boundary and races once it is pinned against it.
 * The zone never eats more than half the viewport, so a narrow timeline does not
 * auto-scroll everywhere.
 */
export function edgeScrollVelocity(
  clientX: number,
  left: number,
  right: number,
  threshold: number = EDGE_SCROLL_THRESHOLD,
  maxSpeed: number = EDGE_SCROLL_MAX_SPEED
): number {
  const width = right - left;
  if (width <= 0) return 0;

  const zone = Math.min(threshold, width / 2);
  if (zone <= 0) return 0;

  if (clientX < left + zone) {
    return -maxSpeed * Math.min(1, (left + zone - clientX) / zone);
  }
  if (clientX > right - zone) {
    return maxSpeed * Math.min(1, (clientX - (right - zone)) / zone);
  }
  return 0;
}

export const NO_RANGE_EXTENSION: GanttRangeExtension = { before: 0, after: 0 };

/**
 * Cap on the ticks added per side
 *
 * Every task is positioned by walking the tick array, so an unbounded range would make
 * that walk unbounded too. 2000 ticks is years of headroom at every scale.
 */
export const MAX_RANGE_EXTENSION_TICKS = 2000;

interface ExtendRangeParams {
  current: GanttRangeExtension;
  scrollLeft: number;
  /** Visible timeline width - the task list pane's share already taken off */
  viewportPx: number;
  /** Width of the whole rendered timeline */
  totalPx: number;
  /** Average px one tick takes at the current scale */
  pxPerTick: number;
  /**
   * Ends that are still free to move (default: both)
   *
   * An end pinned by `visibleRange` cannot grow, and extending it would just be recomputed
   * into the same timeline on every scroll event.
   */
  canExtend?: { before: boolean; after: boolean };
}

/**
 * The extension the range should grow to, or null when the current one still covers the view
 *
 * Extends by roughly a viewport at a time once the view comes within half a viewport of
 * either end, so the user never reaches the wall. One extension is always enough to push
 * the edge back out of the trigger zone, so this cannot loop.
 */
export function extendRangeForScroll({
  current,
  scrollLeft,
  viewportPx,
  totalPx,
  pxPerTick,
  canExtend,
}: ExtendRangeParams): GanttRangeExtension | null {
  if (pxPerTick <= 0 || viewportPx <= 0) return null;

  const chunk = Math.max(1, Math.ceil(viewportPx / pxPerTick));
  const threshold = viewportPx / 2;

  if (
    canExtend?.before !== false &&
    scrollLeft <= threshold &&
    current.before < MAX_RANGE_EXTENSION_TICKS
  ) {
    return {
      ...current,
      before: Math.min(MAX_RANGE_EXTENSION_TICKS, current.before + chunk),
    };
  }

  if (
    canExtend?.after !== false &&
    totalPx - (scrollLeft + viewportPx) <= threshold &&
    current.after < MAX_RANGE_EXTENSION_TICKS
  ) {
    return {
      ...current,
      after: Math.min(MAX_RANGE_EXTENSION_TICKS, current.after + chunk),
    };
  }

  return null;
}
