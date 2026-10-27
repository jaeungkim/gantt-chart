import { GANTT_SCALE_CONFIG } from 'shared/constants';
import { GanttRangeExtension, GanttScaleKey } from 'shared/types';

export const SCALE_LADDER = Object.keys(GANTT_SCALE_CONFIG) as GanttScaleKey[];

const MS_PER_UNIT: Record<'minute' | 'hour' | 'day' | 'week', number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

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
  locked: boolean;
}

export const INITIAL_ZOOM_ACCUMULATOR: ZoomAccumulator = {
  delta: 0,
  lastEventAt: 0,
  locked: false,
};

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

  return {
    state: { delta: 0, lastEventAt: now, locked: true },
    step: Math.sign(delta),
  };
}

const EDGE_SCROLL_THRESHOLD = 48;
const EDGE_SCROLL_MAX_PX_PER_FRAME = 22;

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
    return -EDGE_SCROLL_MAX_PX_PER_FRAME * Math.min(1, (left + zone - clientX) / zone);
  }
  if (clientX > right - zone) {
    return (
      EDGE_SCROLL_MAX_PX_PER_FRAME * Math.min(1, (clientX - (right - zone)) / zone)
    );
  }
  return 0;
}

export function timelineEdges(scrollEl: HTMLElement): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const rect = scrollEl.getBoundingClientRect();
  const grid = scrollEl.querySelector<HTMLElement>('.gantt-grid');

  return {
    left: rect.left + (grid?.offsetWidth ?? 0),
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
  };
}

export const NO_RANGE_EXTENSION: GanttRangeExtension = { before: 0, after: 0 };

export const MAX_RANGE_EXTENSION_TICKS = 2000;

interface ExtendRangeParams {
  current: GanttRangeExtension;
  scrollLeft: number;
  viewportPx: number;
  totalPx: number;
  pxPerTick: number;
  canExtend?: { before: boolean; after: boolean };
}

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
