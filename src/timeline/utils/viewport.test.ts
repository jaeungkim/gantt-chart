import { describe, expect, it } from 'vitest';
import { GANTT_SCALE_CONFIG } from 'shared/constants';
import type { GanttScaleKey } from 'shared/types';
import dayjs from 'core/dates';
import {
  computeTimelineData,
  dateAtOffsetPx,
  calculateDateOffsetPx,
  timelineRange,
} from './geometry';
import {
  accumulateZoom,
  edgeScrollVelocity,
  extendRangeForScroll,
  fitScale,
  INITIAL_ZOOM_ACCUMULATOR,
  MAX_RANGE_EXTENSION_TICKS,
  NO_RANGE_EXTENSION,
  pxPerMs,
  SCALE_LADDER,
  stepScale,
} from './viewport';

const DAY_MS = 86_400_000;

// month scale: one 32px tick per day
const ticks = (...days: string[]) =>
  days.map((d) => ({ startDate: dayjs(d), widthPx: 32 }));

const janTicks = ticks(
  '2025-01-01',
  '2025-01-02',
  '2025-01-03',
  '2025-01-04',
  '2025-01-05',
);

describe('SCALE_LADDER', () => {
  it('is the scale config order, finest first', () => {
    expect(SCALE_LADDER).toEqual(['day', 'week', 'month', 'quarter', 'year']);
  });
});

describe('stepScale', () => {
  it('moves along the ladder in both directions', () => {
    expect(stepScale('month', 1)).toBe('quarter');
    expect(stepScale('month', -1)).toBe('week');
    expect(stepScale('day', 3)).toBe('quarter');
  });

  it('clamps at both ends instead of wrapping', () => {
    expect(stepScale('day', -1)).toBe('day');
    expect(stepScale('year', 1)).toBe('year');
  });

  it('leaves an unknown scale alone', () => {
    expect(stepScale('nope' as GanttScaleKey, 1)).toBe('nope');
  });
});

describe('pxPerMs', () => {
  it('matches the width the timeline actually builds for a tick', () => {
    // A day at week scale is one 4 x 18px tick; at month scale a seventh of a 126px week
    expect(pxPerMs('week') * DAY_MS).toBeCloseTo(72, 6);
    expect(pxPerMs('month') * DAY_MS).toBeCloseTo(18, 6);
    expect(pxPerMs('day') * 3_600_000).toBeCloseTo(12, 6);
  });

  it('gets coarser at every step up the ladder', () => {
    for (let i = 1; i < SCALE_LADDER.length; i++) {
      expect(pxPerMs(SCALE_LADDER[i])).toBeLessThan(
        pxPerMs(SCALE_LADDER[i - 1]),
      );
    }
  });
});

describe('fitScale', () => {
  it('picks the finest scale whose width still fits', () => {
    // 30 days needs 30 * 32 = 960px at month scale, 30 * 216 = 6480px at week scale
    expect(fitScale(30 * DAY_MS, 1000)).toBe('month');
    expect(fitScale(30 * DAY_MS, 7000)).toBe('week');
  });

  it('takes the exact fit rather than the next scale up', () => {
    expect(fitScale(30 * DAY_MS, 540)).toBe('month');
    expect(fitScale(30 * DAY_MS, 539)).toBe('quarter');
  });

  it('falls back to the coarsest scale when nothing fits', () => {
    expect(fitScale(400 * 365 * DAY_MS, 800)).toBe('year');
    expect(fitScale(DAY_MS, 0)).toBe('year');
  });

  it('takes the finest scale for a zero-length project', () => {
    expect(fitScale(0, 800)).toBe('day');
  });
});

describe('accumulateZoom', () => {
  it('adds small deltas up until they make one step', () => {
    let state = INITIAL_ZOOM_ACCUMULATOR;
    let result = accumulateZoom(state, 10, 1000);
    expect(result.step).toBe(0);

    state = result.state;
    result = accumulateZoom(state, 10, 1020);
    expect(result.step).toBe(0);

    state = result.state;
    result = accumulateZoom(state, 10, 1040);
    expect(result.step).toBe(1);
    expect(result.state.delta).toBe(0);
  });

  it('reports one step per gesture, swallowing the rest of the burst', () => {
    let state = INITIAL_ZOOM_ACCUMULATOR;
    let steps = 0;

    // A trackpad pinch: 20 events, 16ms apart, well over the threshold each
    for (let i = 0; i < 20; i++) {
      const result = accumulateZoom(state, 40, 1000 + i * 16);
      state = result.state;
      steps += Math.abs(result.step);
    }

    expect(steps).toBe(1);
  });

  it('allows the next step once the cooldown has passed', () => {
    const first = accumulateZoom(INITIAL_ZOOM_ACCUMULATOR, 40, 1000);
    expect(first.step).toBe(1);

    const second = accumulateZoom(first.state, 40, 1160);
    expect(second.step).toBe(1);
  });

  it('signs the step by the wheel direction', () => {
    expect(accumulateZoom(INITIAL_ZOOM_ACCUMULATOR, -40, 1000).step).toBe(-1);
    expect(accumulateZoom(INITIAL_ZOOM_ACCUMULATOR, 40, 1000).step).toBe(1);
  });

  it('drops what it collected when the gesture went idle', () => {
    const partial = accumulateZoom(INITIAL_ZOOM_ACCUMULATOR, 20, 1000);
    expect(partial.step).toBe(0);

    // Same delta a second later - a new gesture, so the 20 does not carry over
    const later = accumulateZoom(partial.state, 20, 2000);
    expect(later.step).toBe(0);
    expect(later.state.delta).toBe(20);
  });
});

describe('edgeScrollVelocity', () => {
  it('is zero away from the edges', () => {
    expect(edgeScrollVelocity(500, 0, 1000, 48, 20)).toBe(0);
  });

  it('accelerates towards the edge and reverses on the left', () => {
    const near = edgeScrollVelocity(970, 0, 1000, 48, 20);
    const nearer = edgeScrollVelocity(990, 0, 1000, 48, 20);
    expect(near).toBeGreaterThan(0);
    expect(nearer).toBeGreaterThan(near);
    expect(edgeScrollVelocity(30, 0, 1000, 48, 20)).toBeLessThan(0);
  });

  it('caps at maxSpeed past the edge', () => {
    expect(edgeScrollVelocity(1200, 0, 1000, 48, 20)).toBe(20);
    expect(edgeScrollVelocity(-200, 0, 1000, 48, 20)).toBe(-20);
  });

  it('never lets the two zones cover more than the viewport', () => {
    // 40px wide with a 48px threshold - the zones stop at half each, so the midpoint is still quiet
    expect(edgeScrollVelocity(20, 0, 40, 48, 20)).toBe(0);
    expect(edgeScrollVelocity(0, 0, 0, 48, 20)).toBe(0);
  });
});

describe('extendRangeForScroll', () => {
  const base = {
    current: NO_RANGE_EXTENSION,
    viewportPx: 800,
    totalPx: 4000,
    pxPerTick: 32,
  };

  it('leaves the middle of the range alone', () => {
    expect(extendRangeForScroll({ ...base, scrollLeft: 2000 })).toBeNull();
  });

  it('extends in front near the start and behind near the end', () => {
    expect(extendRangeForScroll({ ...base, scrollLeft: 0 })).toEqual({
      before: 25,
      after: 0,
    });
    expect(extendRangeForScroll({ ...base, scrollLeft: 3200 })).toEqual({
      before: 0,
      after: 25,
    });
  });

  it('pushes the edge out of the trigger zone, so it settles after one call', () => {
    const first = extendRangeForScroll({ ...base, scrollLeft: 100 });
    expect(first).not.toBeNull();

    // The origin moved, so the compensation puts scrollLeft past the added width
    const addedPx = first!.before * base.pxPerTick;
    expect(
      extendRangeForScroll({
        ...base,
        current: first!,
        scrollLeft: 100 + addedPx,
        totalPx: base.totalPx + addedPx,
      }),
    ).toBeNull();
  });

  it('leaves a pinned end alone', () => {
    expect(
      extendRangeForScroll({
        ...base,
        scrollLeft: 0,
        canExtend: { before: false, after: true },
      }),
    ).toBeNull();
    expect(
      extendRangeForScroll({
        ...base,
        scrollLeft: 3200,
        canExtend: { before: true, after: false },
      }),
    ).toBeNull();
  });

  it('stops at the cap', () => {
    const capped = { before: MAX_RANGE_EXTENSION_TICKS, after: 0 };
    expect(
      extendRangeForScroll({ ...base, current: capped, scrollLeft: 0 }),
    ).toBeNull();
  });

  it('ignores a viewport the task list has swallowed whole', () => {
    expect(
      extendRangeForScroll({ ...base, viewportPx: 0, scrollLeft: 0 }),
    ).toBeNull();
    expect(
      extendRangeForScroll({ ...base, pxPerTick: 0, scrollLeft: 0 }),
    ).toBeNull();
  });
});

describe('dateAtOffsetPx', () => {
  it('round-trips with calculateDateOffsetPx', () => {
    for (const px of [0, 16, 32, 79, 159.5]) {
      const date = dateAtOffsetPx(px, janTicks, 'week');
      expect(date).not.toBeNull();
      expect(calculateDateOffsetPx(date!, janTicks, 'week')).toBeCloseTo(px, 6);
    }
  });

  it('interpolates inside a tick', () => {
    // Half of the 2 Jan cell is midday
    expect(dateAtOffsetPx(48, janTicks, 'week')!.toISOString()).toBe(
      '2025-01-02T12:00:00.000Z',
    );
  });

  it('returns null outside the rendered range', () => {
    expect(dateAtOffsetPx(-1, janTicks, 'week')).toBeNull();
    expect(dateAtOffsetPx(160, janTicks, 'week')).toBeNull();
    expect(dateAtOffsetPx(0, [], 'week')).toBeNull();
  });
});

describe('timelineRange', () => {
  it('covers the first tick start to the last tick end', () => {
    const range = timelineRange(janTicks, 'week');
    expect(range!.start.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(range!.end.toISOString()).toBe('2025-01-06T00:00:00.000Z');
  });

  it('is null for an empty timeline', () => {
    expect(timelineRange([], 'week')).toBeNull();
  });
});

describe('computeTimelineData range extension', () => {
  const tasks = [
    {
      id: 'a',
      name: 'a',
      startDate: '2025-01-10',
      endDate: '2025-01-12',
      parentId: null,
      sequence: '1',
    },
  ];

  it('adds the requested ticks to each end and leaves the tasks where they are', () => {
    const plain = computeTimelineData(tasks, 'week');
    const extended = computeTimelineData(tasks, 'week', undefined, false, {
      before: 10,
      after: 4,
    });

    expect(extended.bottomCells.length).toBe(plain.bottomCells.length + 14);
    expect(
      plain.bottomCells[0].startDate.diff(
        extended.bottomCells[0].startDate,
        'day',
      ),
    ).toBe(10);

    // The bar keeps its date, so it shifts by the ticks added in front (a week cell = 4 steps)
    const shift = 10 * 4 * GANTT_SCALE_CONFIG.week.basePxPerDragStep;
    expect(extended.transformedTasks[0].barLeft).toBeCloseTo(
      plain.transformedTasks[0].barLeft + shift,
      6,
    );
  });

  it('defaults to no extension', () => {
    expect(computeTimelineData(tasks, 'week').bottomCells.length).toBe(
      computeTimelineData(tasks, 'week', undefined, false, NO_RANGE_EXTENSION)
        .bottomCells.length,
    );
  });
});
