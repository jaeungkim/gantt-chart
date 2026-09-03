import { GANTT_SCALE_CONFIG } from 'shared/constants';
import { GanttRangeExtension, GanttScaleKey } from 'shared/types';

// Zoom ladder, finest first - declaration order in GANTT_SCALE_CONFIG is the ladder
export const SCALE_LADDER = Object.keys(GANTT_SCALE_CONFIG) as GanttScaleKey[];

const MS_PER_UNIT: Record<'minute' | 'hour' | 'day' | 'week', number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

// Approximate: exact for fixed-duration ticks, close enough for month ticks (28-31 days)
export function pxPerMs(scale: GanttScaleKey): number {
  const { basePxPerDragStep, dragStepUnit, dragStepAmount } =
    GANTT_SCALE_CONFIG[scale];
  return basePxPerDragStep / (dragStepAmount * MS_PER_UNIT[dragStepUnit]);
}

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

// Finest scale that fits; coarsest when none does
export function fitScale(
  durationMs: number,
  viewportPx: number
): GanttScaleKey {
  for (const scale of SCALE_LADDER) {
    if (durationMs * pxPerMs(scale) <= viewportPx) return scale;
  }
  return SCALE_LADDER[SCALE_LADDER.length - 1];
}

const ZOOM_DELTA_THRESHOLD = 24;
const ZOOM_GESTURE_GAP_MS = 120;

interface ZoomAccumulator {
  delta: number;
  lastEventAt: number;
  // This gesture already produced its step - the next pause unlocks it
  locked: boolean;
}

export const INITIAL_ZOOM_ACCUMULATOR: ZoomAccumulator = {
  delta: 0,
  lastEventAt: 0,
  locked: false,
};

// step is -1 (finer), 0 or 1 (coarser); one gesture steps once, later deltas swallowed until a pause
export function accumulateZoom(
  state: ZoomAccumulator,
  deltaY: number,
  now: number
): { state: ZoomAccumulator; step: number } {
  const paused = now - state.lastEventAt >= ZOOM_GESTURE_GAP_MS;

  if (!paused && state.locked) {
    return { state: { delta: 0, lastEventAt: now, locked: true }, step: 0 };
  }

  const delta = (paused ? 0 : state.delta) + deltaY;

  if (Math.abs(delta) < ZOOM_DELTA_THRESHOLD) {
    return { state: { delta, lastEventAt: now, locked: false }, step: 0 };
  }

  // Wheel down (positive delta) zooms out, matching the browser's ctrl+wheel
  return {
    state: { delta: 0, lastEventAt: now, locked: true },
    step: Math.sign(delta),
  };
}

const EDGE_SCROLL_THRESHOLD = 48;
// px per frame at the very edge
const EDGE_SCROLL_MAX_SPEED = 22;

// Ramps 0 -> max speed at the edge; the zone caps at half the viewport so a narrow one stays calm
export function edgeScrollVelocity(
  clientX: number,
  left: number,
  right: number
): number {
  const width = right - left;
  if (width <= 0) return 0;

  const zone = Math.min(EDGE_SCROLL_THRESHOLD, width / 2);
  if (zone <= 0) return 0;

  if (clientX < left + zone) {
    return -EDGE_SCROLL_MAX_SPEED * Math.min(1, (left + zone - clientX) / zone);
  }
  if (clientX > right - zone) {
    return (
      EDGE_SCROLL_MAX_SPEED * Math.min(1, (clientX - (right - zone)) / zone)
    );
  }
  return 0;
}

export const NO_RANGE_EXTENSION: GanttRangeExtension = { before: 0, after: 0 };

// Cap per side: every task is positioned by walking the tick array, so the walk must stay bounded
export const MAX_RANGE_EXTENSION_TICKS = 2000;

interface ExtendRangeParams {
  current: GanttRangeExtension;
  scrollLeft: number;
  // Visible timeline width, the task list pane's share already taken off
  viewportPx: number;
  totalPx: number;
  // Average px one tick takes at the current scale
  pxPerTick: number;
  // Ends still free to move (default: both) - an end pinned by `visibleRange` cannot grow
  canExtend?: { before: boolean; after: boolean };
}

// Extension to grow to, or null when the current one still covers the view; grows by ~a viewport
// so one extension always clears the trigger zone and this cannot loop.
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
