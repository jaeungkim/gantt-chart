import { describe, expect, it, vi } from 'vitest';
import dayjs from 'utils/dayjs';
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

  it('shows the year in every header label and drag tooltip format', () => {
    expect(GANTT_SCALE_CONFIG.day.formatHeaderLabel?.(afternoon)).toBe('Sep 1, 2025');
    expect(GANTT_SCALE_CONFIG.week.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.month.formatHeaderLabel?.(afternoon)).toBe('Sep 2025');
    expect(GANTT_SCALE_CONFIG.year.formatHeaderLabel?.(afternoon)).toBe('2025');
    expect(afternoon.format(DATE_FORMATS.day)).toBe('Sep 1, 2025 15:00 UTC');
    expect(afternoon.format(DATE_FORMATS.week)).toBe('Sep 1, 2025');
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
      { targetId: 'a', type: 'FS', fromX: 164, fromY: center, toX: 300, toY: NODE_HEIGHT + center },
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
