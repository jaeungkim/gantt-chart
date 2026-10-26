import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { resolveGeometry } from 'shared/constants';
import type { Task, TaskTransformed } from 'shared/task';
import type { GanttGeometry } from 'shared/types';
import {
  buildDependencies,
  isArrowVisible,
  linkPreview,
  roundedPath,
} from './arrowPath';

const task = (
  id: string,
  sequence: string,
  startDate = '2025-01-02',
  endDate = '2025-01-03',
): Task => ({ id, name: id, startDate, endDate, parentId: null, sequence });
const byId = (tasks: TaskTransformed[]) => new Map(tasks.map((t) => [t.id, t]));
const geometry = resolveGeometry();
const { rowHeight: ROW, barHeight: BAR } = geometry;

describe('roundedPath', () => {
  it('rounds each corner, never by more than half a leg', () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 7 },
      ]),
    ).toBe('M 0 0 L 96.5 0 Q 100 0 100 3.5 L 100 7');
  });

  it('drops repeated and collinear points instead of drawing empty corners', () => {
    expect(
      roundedPath([
        { x: 164, y: 19 },
        { x: 176, y: 19 },
        { x: 176, y: 36 },
        { x: 176, y: 36 },
        { x: 176, y: 43 },
      ]),
    ).toBe('M 164 19 L 171 19 Q 176 19 176 24 L 176 43');
  });
});

describe('buildDependencies', () => {
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
    byId([
      bar('a', 1, 100, extra),
      bar('b', 2, 300, { dependencies: [{ targetId: 'a', type: 'FS' }] }),
    ]);
  const center = ROW / 2;

  const link = (
    predecessor: TaskTransformed,
    successor: TaskTransformed,
    type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS',
    at = geometry,
  ) =>
    buildDependencies(
      byId([
        predecessor,
        { ...successor, dependencies: [{ targetId: predecessor.id, type }] },
      ]),
      {},
      at,
    )[0];

  it('leaves the predecessor end, drops once, and enters the successor start from the left', () => {
    expect(buildDependencies(chain(), {}, geometry)).toEqual([
      {
        targetId: 'a',
        type: 'FS',
        sourceId: 'b',
        fromX: 164,
        fromY: center + BAR / 4,
        toX: 300,
        toY: ROW + center - BAR / 4,
        d: 'M 164 26 L 283 26 Q 288 26 288 31 L 288 45 Q 288 50 293 50 L 300 50',
      },
    ]);
  });

  it('doubles back through the gap under the predecessor when the bars overlap', () => {
    expect(link(bar('a', 1, 100), bar('c', 2, 120)).d).toBe(
      'M 164 26 L 171.625 26 Q 176 26 176 30.375 L 176 30.375 Q 176 34.75 171.625 34.75 L 113 34.75 Q 108 34.75 108 39.75 L 108 45 Q 108 50 113 50 L 120 50',
    );
  });

  it('enters a start from the left and a finish from the right', () => {
    const a = bar('a', 1, 100);
    const b = bar('b', 2, 300);
    expect(link(a, b, 'SS').d).toBe(
      'M 100 26 L 93 26 Q 88 26 88 31 L 88 45 Q 88 50 93 50 L 300 50',
    );
    expect(link(a, b, 'FF').d).toBe(
      'M 164 26 L 371 26 Q 376 26 376 31 L 376 45 Q 376 50 371 50 L 364 50',
    );
    expect(link(a, b, 'SF')).toMatchObject({ fromX: 100, toX: 364 });
  });

  it('climbs when the successor sits above', () => {
    expect(link(bar('a', 2, 100), bar('b', 1, 300)).d).toBe(
      'M 164 50 L 283 50 Q 288 50 288 45 L 288 31 Q 288 26 293 26 L 300 26',
    );
  });

  it('parts an arrow into an edge from one out of it, each on the quarter facing its other end', () => {
    const [into, outOf] = buildDependencies(
      byId([
        bar('a', 1, 100),
        bar('b', 2, 300, { dependencies: [{ targetId: 'a', type: 'FS' }] }),
        bar('c', 3, 500, { dependencies: [{ targetId: 'b', type: 'SS' }] }),
      ]),
      {},
      geometry,
    );
    expect(into).toMatchObject({ toX: 300, toY: ROW + center - BAR / 4 });
    expect(outOf).toMatchObject({ fromX: 300, fromY: ROW + center + BAR / 4 });
  });

  it('measures the quarter on the thinner summary bar', () => {
    expect(link(bar('a', 1, 100, { isSummary: true }), bar('b', 2, 300)).fromY).toBe(23.5);
  });

  it('places the ends and the row-gap lane by the row and bar heights it is given', () => {
    const tall = resolveGeometry(50, 40);
    const a = bar('a', 1, 100);

    expect(link(a, bar('b', 2, 300), 'FS', tall)).toMatchObject({
      fromY: 25 + 40 / 4,
      toY: 50 + 25 - 40 / 4,
    });
    expect(link(a, bar('c', 2, 120), 'FS', tall).d).toBe(
      'M 164 35 L 171 35 Q 176 35 176 40 L 176 41.75 Q 176 46.75 171 46.75 L 113 46.75 Q 108 46.75 108 51.75 L 108 60 Q 108 65 113 65 L 120 65',
    );
    expect(
      link(bar('a', 1, 100, { isSummary: true }), bar('b', 2, 300), 'FS', tall).fromY,
    ).toBe(25 + 26 / 4);
  });

  describe('the row-gap lane', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const halfStroke =
      Number(css.match(/\.gantt-dependency-arrow \{[^}]*stroke-width:\s*([\d.]+)/)![1]) / 2;
    // CSS centres each bar in its row, above the row's 1px bottom rule
    const barBox = (order: number, { rowHeight, barHeight }: GanttGeometry) => {
      const top = (order - 1) * rowHeight + (rowHeight - 1 - barHeight) / 2;
      return { top, bottom: top + barHeight };
    };
    const laneY = (d: string) => {
      const cornerYs = [...d.matchAll(/Q \S+ (\S+)/g)].map(([, y]) => Number(y));
      expect(cornerYs).toHaveLength(4);
      return cornerYs[1];
    };
    const expectClearOfBars = (at: GanttGeometry) => {
      const down = laneY(link(bar('a', 1, 100), bar('b', 2, 120), 'FS', at).d);
      expect(down - halfStroke).toBeGreaterThanOrEqual(barBox(1, at).bottom);
      expect(down + halfStroke).toBeLessThanOrEqual(at.rowHeight - 1);

      const up = laneY(link(bar('a', 2, 100), bar('b', 1, 120), 'FS', at).d);
      expect(up - halfStroke).toBeGreaterThanOrEqual(at.rowHeight);
      expect(up + halfStroke).toBeLessThanOrEqual(barBox(2, at).top);
    };

    it.each([28, 30, 32, 38, 50])(
      'runs between the bar and the row rule at rowHeight %i',
      (rowHeight) => expectClearOfBars(resolveGeometry(rowHeight)),
    );

    it('still fits when the bar is as tall as the row allows', () => {
      expectClearOfBars(resolveGeometry(28, 28));
    });
  });

  describe('linkPreview', () => {
    const a = bar('a', 1, 100);
    const b = bar('b', 2, 300);
    const index = byId([a, b]);
    const draft = {
      fromTaskId: 'a',
      fromAnchor: 'end' as const,
      fromX: 164,
      fromY: center,
      toX: 310,
      toY: ROW + 30,
      hoverTaskId: 'b',
      hoverAnchor: 'start' as const,
      rejection: null,
    };

    it('draws the arrow a release would commit once the cursor arms a target edge', () => {
      expect(linkPreview(draft, index, geometry)).toMatchObject({
        d: link(a, b).d,
        fromX: 164,
        fromY: center + BAR / 4,
      });
    });

    it('follows the cursor in a straight line over empty space or a rejected target', () => {
      const straight = {
        d: `M 164 ${center} L 310 ${ROW + 30}`,
        fromX: 164,
        fromY: center,
      };
      expect(
        linkPreview({ ...draft, hoverTaskId: null, hoverAnchor: null }, index, geometry),
      ).toEqual(straight);
      expect(
        linkPreview({ ...draft, rejection: 'cycle' as const }, index, geometry),
      ).toEqual(straight);
    });

    it('starts the line at the source bar as drawn now, after a prepend moved it mid-drag', () => {
      const shifted = byId([{ ...a, barLeft: a.barLeft + 1008 }, b]);
      expect(
        linkPreview({ ...draft, hoverTaskId: null, hoverAnchor: null }, shifted, geometry),
      ).toEqual({
        d: `M ${164 + 1008} ${center} L 310 ${ROW + 30}`,
        fromX: 164 + 1008,
        fromY: center,
      });
    });
  });

  it('draws a straight arrow between lane neighbors in one row', () => {
    expect(link(bar('a', 2, 100), bar('b', 2, 300)).d).toBe('M 164 57 L 300 57');
  });

  it('links a milestone at the edge of its drawn box', () => {
    expect(link(bar('a', 1, 100, { barWidth: 1 }), bar('b', 2, 300)).fromX).toBe(
      124,
    );
  });

  it('follows the live offset of whichever end is being dragged', () => {
    expect(
      buildDependencies(chain(), { a: { offsetX: 32, offsetWidth: 0 } }, geometry)[0],
    ).toMatchObject({ fromX: 196, toX: 300 });
    expect(
      buildDependencies(chain(), { a: { offsetX: 0, offsetWidth: 32 } }, geometry)[0],
    ).toMatchObject({ fromX: 196, toX: 300 });
    expect(
      buildDependencies(chain(), { b: { offsetX: -32, offsetWidth: 0 } }, geometry)[0],
    ).toMatchObject({ fromX: 164, toX: 268 });
  });

  it('skips an unrecognized dependency type instead of throwing, and logs nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknownDep = [
      { targetId: 'a', type: 'fs' },
    ] as unknown as TaskTransformed['dependencies'];
    const tasks = byId([
      bar('a', 1, 100),
      bar('b', 2, 300, { dependencies: unknownDep }),
      bar('c', 3, 500, { dependencies: unknownDep }),
    ]);

    expect(buildDependencies(tasks, {}, geometry)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips dependencies pointing at a task that is not in the chart', () => {
    expect(
      buildDependencies(
        byId([
          bar('b', 1, 300, { dependencies: [{ targetId: 'gone', type: 'FS' }] }),
        ]),
        {},
        geometry,
      ),
    ).toEqual([]);
  });
});

describe('isArrowVisible', () => {
  const viewport: Parameters<typeof isArrowVisible>[1] = {
    rowStartPx: 100,
    rowEndPx: 300,
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
    expect(isArrowVisible(arrow(200, 0, 300, 500), viewport)).toBe(true);
    expect(isArrowVisible(arrow(0, 150, 900, 250), viewport)).toBe(true);
  });

  it('allows for the elbow overshooting the endpoints', () => {
    expect(isArrowVisible(arrow(80, 150, 90, 250), viewport)).toBe(true);
    expect(isArrowVisible(arrow(200, 60, 300, 80), viewport)).toBe(true);
  });
});
