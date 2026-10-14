import { describe, expect, it, vi } from 'vitest';
import { NODE_HEIGHT } from 'shared/constants';
import type { Task, TaskTransformed } from 'shared/task';
import {
  buildDependencies,
  buildTaskIndex,
  getSmartGanttPath,
  isArrowVisible,
  type ArrowViewport,
} from './arrowPath';

const task = (
  id: string,
  sequence: string,
  startDate = '2025-01-02',
  endDate = '2025-01-03',
): Task => ({ id, name: id, startDate, endDate, parentId: null, sequence });

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
    expect(isArrowVisible(arrow(200, 0, 300, 500), viewport)).toBe(true);
    expect(isArrowVisible(arrow(0, 150, 900, 250), viewport)).toBe(true);
  });

  it('allows for the elbow overshooting the endpoints', () => {
    expect(isArrowVisible(arrow(80, 150, 90, 250), viewport)).toBe(true);
    expect(isArrowVisible(arrow(200, 60, 300, 80), viewport)).toBe(true);
  });
});
