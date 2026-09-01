import { describe, expect, it, vi } from 'vitest';
import type { Dayjs } from 'dayjs';
import dayjs from 'core/dates';
import {
  DATE_FORMATS,
  GANTT_SCALE_CONFIG,
  MILESTONE_HALF_DIAGONAL,
  NODE_HEIGHT,
} from 'constants/gantt';
import { normalizeProgress, type Task, type TaskTransformed } from 'types/task';
import {
  buildDependencies,
  buildTaskIndex,
  getSmartGanttPath,
  isArrowVisible,
  type ArrowViewport,
} from './arrowPath';
import { mergeHeaderGroups } from './headerUtils';
import {
  calculateDateOffsetPx,
  calculateDateOffsets,
  computeNonWorkingRanges,
  computeTimelineData,
  createTopHeaderGroups,
  originShiftPx,
  snapDrawnRange,
} from './timeline';
import { transformTasks } from './transformData';

// month scale: tickUnit day, unitPerTick 1, basePxPerDragStep 32 -> every tick is exactly 32px.
// Bare dates parse as local midnight on both sides, so assertions are timezone-independent.
const ticks = (...days: string[]) => days.map((d) => ({ startDate: dayjs(d), widthPx: 32 }));

const task = (
  id: string,
  sequence: string,
  startDate = '2025-01-02',
  endDate = '2025-01-03',
): Task => ({ id, name: id, startDate, endDate, parentId: null, sequence });

const group = (label: string, widthPx: number) => ({
  label,
  widthPx,
  startDate: dayjs('2025-01-01'),
});

describe('transformTasks', () => {
  it('sorts by numeric sequence (1.10 after 1.2) and derives depth/order', () => {
    const out = transformTasks(
      [task('b', '1.10'), task('a', '1.2'), task('c', '2')],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(out.map((t) => t.depth)).toEqual([1, 1, 0]);
    expect(out.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('positions milestones at startDate as a point, ignoring endDate', () => {
    const [m] = transformTasks(
      [{ ...task('m', '1', '2025-01-02', '2025-01-03'), type: 'milestone' as const }],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(m.barLeft).toBe(32);
    expect(m.barWidth).toBe(1);
  });

  it('leaves the baseline geometry off tasks that carry no baseline', () => {
    const [t] = transformTasks(
      [task('a', '1')],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(t.baselineLeft).toBeUndefined();
    expect(t.baselineWidth).toBeUndefined();
  });

  it('measures the baseline bar independently of the live one', () => {
    const [t] = transformTasks(
      [
        {
          ...task('a', '1', '2025-01-02', '2025-01-03'),
          baselineStart: '2025-01-01',
          baselineEnd: '2025-01-03',
        },
      ],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(t.barLeft).toBe(32);
    expect(t.baselineLeft).toBe(0);
    expect(t.baselineWidth).toBe(64);
  });

  it('gives a milestone baseline a single point', () => {
    const [t] = transformTasks(
      [
        {
          ...task('m', '1', '2025-01-03', '2025-01-03'),
          type: 'milestone' as const,
          baselineStart: '2025-01-02',
          baselineEnd: '2025-01-03',
        },
      ],
      ticks('2025-01-01', '2025-01-02', '2025-01-03'),
      'month',
    );
    expect(t.baselineLeft).toBe(32);
    expect(t.baselineWidth).toBe(1);
  });
});

describe('normalizeProgress', () => {
  it('clamps to 0-100 and rejects missing or NaN values', () => {
    expect(normalizeProgress(42)).toBe(42);
    expect(normalizeProgress(-10)).toBe(0);
    expect(normalizeProgress(150)).toBe(100);
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress(Number.NaN)).toBeNull();
  });
});

describe('calculateDateOffsets', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('skips ticks before the task and spans whole ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-03'), t, 'month')).toEqual({
      barMarginLeftAmount: 32,
      barWidthSize: 32,
    });
  });

  it('handles a task starting mid-tick', () => {
    expect(
      calculateDateOffsets(dayjs('2025-01-02T12:00'), dayjs('2025-01-03'), t, 'month'),
    ).toEqual({ barMarginLeftAmount: 48, barWidthSize: 16 });
  });

  it('clamps zero-duration to 1px and returns zeros for no ticks', () => {
    expect(calculateDateOffsets(dayjs('2025-01-02'), dayjs('2025-01-02'), t, 'month')).toEqual({
      barMarginLeftAmount: 32,
      barWidthSize: 1,
    });
    expect(calculateDateOffsets(dayjs(), dayjs(), [], 'month')).toEqual({
      barMarginLeftAmount: 0,
      barWidthSize: 0,
    });
  });
});

describe('calculateDateOffsetPx', () => {
  const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');

  it('offsets whole and partial ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2025-01-01'), t, 'month')).toBe(0);
    expect(calculateDateOffsetPx(dayjs('2025-01-02'), t, 'month')).toBe(32);
    expect(calculateDateOffsetPx(dayjs('2025-01-02T12:00'), t, 'month')).toBe(48);
  });

  it('returns null outside the timeline range and for no ticks', () => {
    expect(calculateDateOffsetPx(dayjs('2024-12-31'), t, 'month')).toBeNull();
    expect(calculateDateOffsetPx(dayjs('2025-01-04'), t, 'month')).toBeNull();
    expect(calculateDateOffsetPx(dayjs(), [], 'month')).toBeNull();
  });
});

describe('computeNonWorkingRanges', () => {
  // 2025-01-01 is a Wednesday; Jan 4 (Sat) and Jan 5 (Sun) are the weekend.
  const week = ticks(
    '2025-01-01',
    '2025-01-02',
    '2025-01-03',
    '2025-01-04',
    '2025-01-05',
    '2025-01-06',
    '2025-01-07',
  );
  const isWeekend = (d: ReturnType<typeof dayjs>) => d.day() === 0 || d.day() === 6;

  it('merges adjacent weekend ticks into one range', () => {
    expect(computeNonWorkingRanges(week, 'month', isWeekend)).toEqual([
      { left: 96, width: 64 },
    ]);
  });

  it('keeps non-adjacent ranges separate', () => {
    const withHoliday = (d: ReturnType<typeof dayjs>) =>
      isWeekend(d) || d.format('YYYY-MM-DD') === '2025-01-07';
    expect(computeNonWorkingRanges(week, 'month', withHoliday)).toEqual([
      { left: 96, width: 64 },
      { left: 192, width: 32 },
    ]);
  });

  it('returns nothing for scales coarser than a day', () => {
    expect(computeNonWorkingRanges(week, 'year', isWeekend)).toEqual([]);
    expect(computeNonWorkingRanges([], 'month', isWeekend)).toEqual([]);
  });
});

describe('GANTT_SCALE_CONFIG labels', () => {
  const afternoon = dayjs('2025-09-01T15:00');

  it('labels day ticks in 24-hour time so AM and PM differ', () => {
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T09:00'))).toBe('09');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(afternoon)).toBe('15');
    expect(GANTT_SCALE_CONFIG.day.formatTickLabel?.(dayjs('2025-09-01T00:00'))).toBe('00');
  });

  it('labels year-scale month ticks with the month, not the day of month', () => {
    expect(GANTT_SCALE_CONFIG.year.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(GANTT_SCALE_CONFIG.week.formatTickLabel?.(afternoon)).toBe('1');
    expect(GANTT_SCALE_CONFIG.month.formatTickLabel?.(afternoon)).toBe('1');
  });

  it('spells the minutes out on hour ticks, where drag steps are quarter-hours', () => {
    expect(GANTT_SCALE_CONFIG.hour.formatTickLabel?.(afternoon)).toBe('15:00');
    expect(GANTT_SCALE_CONFIG.hour.formatTickLabel?.(dayjs('2025-09-01T00:00'))).toBe('00:00');
    expect(GANTT_SCALE_CONFIG.hour.formatHeaderLabel?.(afternoon)).toBe('Sep 1, 2025');
  });

  it('labels quarter ticks with the month and the group with the quarter', () => {
    expect(GANTT_SCALE_CONFIG.quarter.formatTickLabel?.(afternoon)).toBe('Sep');
    expect(
      ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].map((d) =>
        GANTT_SCALE_CONFIG.quarter.formatHeaderLabel?.(dayjs(d)),
      ),
    ).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']);
  });

  it('shows the year in every header label and drag tooltip format', () => {
    expect(GANTT_SCALE_CONFIG.day.formatHeaderLabel?.(afternoon)).toBe('Sep 1, 2025');
    expect(GANTT_SCALE_CONFIG.week.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.month.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.year.formatHeaderLabel?.(afternoon)).toBe('2025');
    expect(afternoon.format(DATE_FORMATS.day)).toBe('Sep 1, 2025 15:00 UTC');
    expect(afternoon.format(DATE_FORMATS.week)).toBe('Sep 1, 2025');
    expect(afternoon.format(DATE_FORMATS.hour)).toBe('Sep 1, 2025 15:00 UTC');
    expect(afternoon.format(DATE_FORMATS.quarter)).toBe('Sep 2025');
  });

  it('lists the scales finest first, so the selector reads as a zoom ladder', () => {
    expect(Object.keys(GANTT_SCALE_CONFIG)).toEqual([
      'hour',
      'day',
      'week',
      'month',
      'quarter',
      'year',
    ]);
  });
});

describe('createTopHeaderGroups', () => {
  it('groups daily ticks into month headers', () => {
    expect(
      createTopHeaderGroups(ticks('2025-01-30', '2025-01-31', '2025-02-01'), 'month'),
    ).toMatchObject([
      { label: 'Jan 2025', widthPx: 64 },
      { label: 'Feb 2025', widthPx: 32 },
    ]);
    expect(createTopHeaderGroups([], 'month')).toEqual([]);
  });

  it('groups monthly ticks into year headers at year scale', () => {
    expect(
      createTopHeaderGroups(ticks('2025-11-01', '2025-12-01', '2026-01-01'), 'year'),
    ).toMatchObject([
      { label: '2025', widthPx: 64 },
      { label: '2026', widthPx: 32 },
    ]);
  });

  it('groups hourly ticks into day headers at hour scale', () => {
    expect(
      createTopHeaderGroups(
        ticks('2025-09-01T22:00', '2025-09-01T23:00', '2025-09-02T00:00'),
        'hour',
      ),
    ).toMatchObject([
      { label: 'Sep 1, 2025', widthPx: 64 },
      { label: 'Sep 2, 2025', widthPx: 32 },
    ]);
  });

  it('groups monthly ticks into quarter headers at quarter scale', () => {
    expect(
      createTopHeaderGroups(
        ticks('2025-02-01', '2025-03-01', '2025-04-01', '2025-07-01'),
        'quarter',
      ),
    ).toMatchObject([
      { label: 'Q1 2025', widthPx: 64 },
      { label: 'Q2 2025', widthPx: 32 },
      { label: 'Q3 2025', widthPx: 32 },
    ]);
  });
});

describe('mergeHeaderGroups', () => {
  it('merges adjacent equal labels without mutating input', () => {
    const input = [group('Jan', 10), group('Jan', 20), group('Feb', 5)];
    expect(mergeHeaderGroups(input)).toMatchObject([
      { label: 'Jan', widthPx: 30 },
      { label: 'Feb', widthPx: 5 },
    ]);
    expect(input[0].widthPx).toBe(10);
  });
});

describe('getSmartGanttPath', () => {
  it('draws rounded FS elbows (cornerRadius 7)', () => {
    expect(getSmartGanttPath('FS', 0, 0, 100, 50)).toBe(
      'M 0 0 h 43 a 7 7 0 0 1 7 7 v 36 a 7 7 0 0 0 7 7 h 43',
    );
    expect(getSmartGanttPath('FS', 0, 50, 100, 0)).toBe(
      'M 0 50 h 43 a 7 7 0 0 0 7 -7 v -36 a 7 7 0 0 1 7 -7 h 43',
    );
  });

  it('falls back for off-screen rows and unknown dependency types', () => {
    expect(getSmartGanttPath('FS', 10, 5, 110, -3)).toBe('M 10 5 h 50');
    expect(getSmartGanttPath('XX', 0, 0, 10, 20)).toBe('M 0 0 L 10 20');
  });
});

describe('buildDependencies', () => {
  // A(order 1) is the predecessor, B(order 2) owns the FS dependency on A.
  const bar = (
    id: string,
    order: number,
    barLeft: number,
    extra: Partial<TaskTransformed> = {},
  ): TaskTransformed => ({
    ...task(id, `${order}`),
    barLeft,
    barWidth: 64,
    depth: 0,
    order,
    originalOrder: order,
    ...extra,
  });
  const chain = (extra: Partial<TaskTransformed> = {}) =>
    buildTaskIndex([
      bar('a', 1, 100, extra),
      bar('b', 2, 300, { dependencies: [{ targetId: 'a', type: 'FS' }] }),
    ]);
  const center = NODE_HEIGHT / 2;

  it('anchors an FS arrow from the predecessor end to the successor start', () => {
    expect(buildDependencies(chain(), {})).toEqual([
      {
        targetId: 'a',
        type: 'FS',
        sourceId: 'b',
        fromX: 164,
        fromY: center,
        toX: 300,
        toY: NODE_HEIGHT + center,
      },
    ]);
  });

  it('indexes tasks by id and keeps task order for iteration', () => {
    const index = buildTaskIndex([bar('a', 1, 100), bar('b', 2, 300)]);
    expect([...index.keys()]).toEqual(['a', 'b']);
    expect(index.get('b')?.barLeft).toBe(300);
  });

  it('follows the live offset of whichever end is being dragged', () => {
    // Dragging the predecessor (A) has to bring the arrow's start point along (#66)
    expect(
      buildDependencies(chain(), { a: { offsetX: 32, offsetWidth: 0 } })[0],
    ).toMatchObject({ fromX: 196, toX: 300 });
    // Same for resizing the predecessor's right edge
    expect(
      buildDependencies(chain(), { a: { offsetX: 0, offsetWidth: 32 } })[0],
    ).toMatchObject({ fromX: 196, toX: 300 });
    // Dragging the successor (B) moves only the end point
    expect(
      buildDependencies(chain(), { b: { offsetX: -32, offsetWidth: 0 } })[0],
    ).toMatchObject({ fromX: 164, toX: 268 });
  });

  it('anchors milestones at the diamond vertices, offset included', () => {
    const [dep] = buildDependencies(chain({ type: 'milestone', barWidth: 1 }), {
      a: { offsetX: 32, offsetWidth: 0 },
    });
    expect(dep.fromX).toBe(132 + MILESTONE_HALF_DIAGONAL);
  });

  it('skips an unrecognized dependency type instead of throwing, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Consumer-supplied JSON can carry values outside the type
    const unknownDep = [
      { targetId: 'a', type: 'fs' },
    ] as unknown as TaskTransformed['dependencies'];
    const tasks = buildTaskIndex([
      bar('a', 1, 100),
      bar('b', 2, 300, { dependencies: unknownDep }),
      bar('c', 3, 500, { dependencies: unknownDep }),
    ]);

    expect(buildDependencies(tasks, {})).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('skips dependencies pointing at a task that is not in the chart', () => {
    expect(
      buildDependencies(
        buildTaskIndex([
          bar('b', 1, 300, { dependencies: [{ targetId: 'gone', type: 'FS' }] }),
        ]),
        {},
      ),
    ).toEqual([]);
  });
});

describe('isArrowVisible', () => {
  // Visible area: 100-500 horizontally, 100-300 vertically
  const viewport: ArrowViewport = {
    topPx: 100,
    bottomPx: 300,
    isBarVisible: (left, width) => left + width >= 100 && left <= 500,
  };
  const arrow = (fromX: number, fromY: number, toX: number, toY: number) => ({
    fromX,
    fromY,
    toX,
    toY,
  });

  it('keeps arrows that overlap the viewport', () => {
    expect(isArrowVisible(arrow(200, 150, 300, 250), viewport)).toBe(true);
  });

  it('drops arrows fully above, below, left of, or right of the viewport', () => {
    expect(isArrowVisible(arrow(200, 0, 300, 40), viewport)).toBe(false);
    expect(isArrowVisible(arrow(200, 400, 300, 450), viewport)).toBe(false);
    expect(isArrowVisible(arrow(0, 150, 40, 250), viewport)).toBe(false);
    expect(isArrowVisible(arrow(600, 150, 700, 250), viewport)).toBe(false);
  });

  it('keeps an arrow whose ends straddle the viewport on either axis', () => {
    // Both the top and bottom ends are off-screen, but the line crosses the viewport vertically
    expect(isArrowVisible(arrow(200, 0, 300, 500), viewport)).toBe(true);
    // Same on the left/right axis
    expect(isArrowVisible(arrow(0, 150, 900, 250), viewport)).toBe(true);
  });

  it('allows for the elbow overshooting the endpoints', () => {
    // The elbowed path runs a little past the endpoints, so arrows near the boundary are kept
    expect(isArrowVisible(arrow(80, 150, 90, 250), viewport)).toBe(true);
    expect(isArrowVisible(arrow(200, 60, 300, 80), viewport)).toBe(true);
  });
});

describe('computeTimelineData', () => {
  it('pads the range by 5 ticks on each side and positions bars', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-01-10', '2025-01-12')],
      'month',
    );
    expect(bottomCells).toHaveLength(12); // 2025-01-05 .. 2025-01-16
    expect(transformedTasks[0]).toMatchObject({ barLeft: 160, barWidth: 64 }); // 5*32, 2*32
    expect(computeTimelineData([], 'month')).toEqual({ bottomCells: [], transformedTasks: [] });
  });

  it('builds 120px hourly cells at hour scale', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-01-10T09:00', '2025-01-10T12:00')],
      'hour',
    );

    // 09:00 - 5h .. 12:00 + 5h, one cell an hour
    expect(bottomCells).toHaveLength(13);
    expect(bottomCells[0].startDate.toISOString()).toBe('2025-01-10T04:00:00.000Z');
    expect(new Set(bottomCells.map((c) => c.widthPx))).toEqual(new Set([120]));
    expect(transformedTasks[0]).toMatchObject({ barLeft: 600, barWidth: 360 }); // 5h, 3h
  });

  it('builds month cells sized by real month length at quarter scale', () => {
    const { bottomCells, transformedTasks } = computeTimelineData(
      [task('a', '1', '2025-02-10', '2025-03-10')],
      'quarter',
    );

    // 2024-09 .. 2025-08, one cell a month, 8px a day
    expect(bottomCells).toHaveLength(12);
    expect(bottomCells[0].startDate.toISOString()).toBe('2024-09-01T00:00:00.000Z');
    expect(
      new Map(bottomCells.map((c) => [c.startDate.format('YYYY-MM'), c.widthPx])).get(
        '2025-02',
      ),
    ).toBe(28 * 8);
    expect(transformedTasks[0]).toMatchObject({ barLeft: 1296, barWidth: 224 }); // 28 days
  });
});

describe('computeTimelineData with baselines', () => {
  it('widens the timeline so a baseline outside the live bar is not clipped', () => {
    const withBaseline = computeTimelineData(
      [
        {
          ...task('a', '1', '2025-03-10', '2025-03-12'),
          baselineStart: '2025-03-01',
          baselineEnd: '2025-03-04',
        },
      ],
      'month',
    );
    const first = withBaseline.bottomCells[0].startDate;
    expect(first.valueOf()).toBeLessThanOrEqual(dayjs('2025-03-01').valueOf());
    expect(withBaseline.transformedTasks[0].baselineLeft).toBeGreaterThanOrEqual(0);
  });
});

describe('snapDrawnRange', () => {
  const iso = (range: { startDate: Dayjs; endDate: Dayjs } | null) =>
    range && [range.startDate.format(), range.endDate.format()];

  it('snaps outwards to the day ticks the drag covered (month scale, 32px a day)', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05');
    // 40px is inside the second tick, 100px inside the fourth
    expect(iso(snapDrawnRange(40, 100, t, 'month'))).toEqual([
      dayjs('2025-01-02').format(),
      dayjs('2025-01-05').format(),
    ]);
  });

  it('gives a one-tick task when the drag stays inside a single tick', () => {
    const t = ticks('2025-01-01', '2025-01-02');
    expect(iso(snapDrawnRange(4, 20, t, 'month'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-01-02').format(),
    ]);
  });

  it('reads a right-to-left drag the same way', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03');
    expect(iso(snapDrawnRange(90, 10, t, 'month'))).toEqual(
      iso(snapDrawnRange(10, 90, t, 'month')),
    );
  });

  it('snaps to the hour on the day scale (32px an hour)', () => {
    const t = ['2025-01-01T00:00', '2025-01-01T01:00', '2025-01-01T02:00'].map((d) => ({
      startDate: dayjs(d),
      widthPx: 32,
    }));
    expect(iso(snapDrawnRange(10, 40, t, 'day'))).toEqual([
      dayjs('2025-01-01T00:00').format(),
      dayjs('2025-01-01T02:00').format(),
    ]);
  });

  it('snaps to the quarter-hour tick on the hour scale (120px an hour)', () => {
    const t = ['2025-01-01T00:00', '2025-01-01T01:00'].map((d) => ({
      startDate: dayjs(d),
      widthPx: 120,
    }));
    expect(iso(snapDrawnRange(0, 5, t, 'hour'))).toEqual([
      dayjs('2025-01-01T00:00').format(),
      dayjs('2025-01-01T01:00').format(),
    ]);
  });

  it('snaps to whole months on the year scale (4px a day)', () => {
    const t = [
      { startDate: dayjs('2025-01-01'), widthPx: 31 * 4 },
      { startDate: dayjs('2025-02-01'), widthPx: 28 * 4 },
      { startDate: dayjs('2025-03-01'), widthPx: 31 * 4 },
    ];
    expect(iso(snapDrawnRange(10, 130, t, 'year'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-03-01').format(),
    ]);
  });

  it('clamps a drag that runs past either end of the timeline', () => {
    const t = ticks('2025-01-01', '2025-01-02');
    expect(iso(snapDrawnRange(-500, 9999, t, 'month'))).toEqual([
      dayjs('2025-01-01').format(),
      dayjs('2025-01-03').format(),
    ]);
  });

  it('reports the snapped box so the ghost bar covers whole ticks', () => {
    const t = ticks('2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04');
    expect(snapDrawnRange(40, 70, t, 'month')).toMatchObject({
      leftPx: 32,
      widthPx: 64,
    });
  });

  it('returns null without a timeline', () => {
    expect(snapDrawnRange(0, 100, [], 'month')).toBeNull();
  });
});

describe('originShiftPx', () => {
  const prev = ticks('2025-01-05', '2025-01-06', '2025-01-07');

  it('returns how far the origin moved when cells are prepended', () => {
    const next = ticks('2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07');
    expect(originShiftPx(prev, next, 'month')).toBe(64); // two 32px cells added in front
  });

  it('returns a negative shift when leading cells disappear', () => {
    const next = ticks('2025-01-07', '2025-01-08');
    expect(originShiftPx(prev, next, 'month')).toBe(-64);
  });

  it('is zero when the origin is unchanged or a timeline is empty', () => {
    expect(originShiftPx(prev, ticks('2025-01-05', '2025-01-06'), 'month')).toBe(0);
    expect(originShiftPx([], prev, 'month')).toBe(0);
    expect(originShiftPx(prev, [], 'month')).toBe(0);
  });
});
