import { describe, expect, it } from 'vitest';
import { CALENDAR_DAYS, createWorkingCalendar } from './calendar';
import {
  backwardPass,
  computeCriticalPath,
  forwardPass,
  type EarlyDates,
} from './criticalPath';
import dayjs from './dates';
import { buildTaskGraph } from './scheduling';
import type { DependencyType, Task, TaskDependency } from './types';

const task = (
  id: string,
  startDate: string,
  endDate: string,
  dependencies: TaskDependency[] = []
): Task => ({
  id,
  name: id,
  startDate: `2025-${startDate}`,
  endDate: `2025-${endDate}`,
  parentId: null,
  sequence: id,
  dependencies,
});

const dep = (targetId: string, type: DependencyType = 'FS', lag?: number) =>
  (lag === undefined ? { targetId, type } : { targetId, type, lag }) as TaskDependency;

const day = (value: string) => `2025-${value}T00:00:00.000Z`;

/**
 * The reference project, worked out by hand.
 *
 *   A 06-02..06-05 (3d)
 *   |-> B 06-05..06-10 (5d) --\
 *   \-> C 06-05..06-07 (2d) --+-> D 06-10..06-13 (3d) -> E 06-13..06-16 (3d)
 *
 * Forward: nothing is pushed - every task already sits at its earliest legal date, so the
 * project finishes 06-16.
 * Backward: E and D are pinned by the finish; B must end by 06-10 to hand over to D, so it
 * has no room either; C only has to end by 06-10 but finishes 06-07, giving it three days.
 * Critical path: A -> B -> D -> E, with C carrying three days of slack.
 */
const reference: Task[] = [
  task('A', '06-02', '06-05'),
  task('B', '06-05', '06-10', [dep('A')]),
  task('C', '06-05', '06-07', [dep('A')]),
  task('D', '06-10', '06-13', [dep('B'), dep('C')]),
  task('E', '06-13', '06-16', [dep('D')]),
];

const slackOf = (tasks: Task[]) => {
  const { metrics } = computeCriticalPath(tasks);
  return Object.fromEntries(
    [...metrics].map(([id, m]) => [id, [m.totalSlack, m.freeSlack]])
  );
};

describe('the reference project', () => {
  it('produces the hand-computed early dates', () => {
    const early = forwardPass(reference);

    expect(early.get('A')?.start.toISOString()).toBe(day('06-02'));
    expect(early.get('A')?.finish.toISOString()).toBe(day('06-05'));
    expect(early.get('B')?.finish.toISOString()).toBe(day('06-10'));
    expect(early.get('C')?.finish.toISOString()).toBe(day('06-07'));
    expect(early.get('D')?.start.toISOString()).toBe(day('06-10'));
    expect(early.get('E')?.finish.toISOString()).toBe(day('06-16'));
  });

  it('produces the hand-computed late dates', () => {
    const result = computeCriticalPath(reference);

    expect(result.metrics.get('C')?.lateStart).toBe(day('06-08'));
    expect(result.metrics.get('C')?.lateFinish).toBe(day('06-10'));
    expect(result.metrics.get('B')?.lateFinish).toBe(day('06-10'));
    expect(result.metrics.get('E')?.lateFinish).toBe(day('06-16'));
    expect(result.projectFinish).toBe(day('06-16'));
  });

  it('produces the hand-computed slack', () => {
    expect(slackOf(reference)).toEqual({
      A: [0, 0],
      B: [0, 0],
      C: [3, 3],
      D: [0, 0],
      E: [0, 0],
    });
  });

  it('marks A -> B -> D -> E critical and leaves C out', () => {
    const result = computeCriticalPath(reference);

    expect([...result.criticalTaskIds].sort()).toEqual(['A', 'B', 'D', 'E']);
    expect([...result.criticalLinkIds].sort()).toEqual([
      'A>B:FS',
      'B>D:FS',
      'D>E:FS',
    ]);
  });

  it('reports duration in days', () => {
    const { metrics } = computeCriticalPath(reference);
    expect(metrics.get('A')?.duration).toBe(3);
    expect(metrics.get('B')?.duration).toBe(5);
    expect(metrics.get('C')?.duration).toBe(2);
  });

  it('drops a finished task off the critical path', () => {
    const done = reference.map((t) =>
      t.id === 'B' ? { ...t, progress: 100 } : t
    );
    const result = computeCriticalPath(done);

    expect(result.criticalTaskIds.has('B')).toBe(false);
    // A link needs both ends on the path, so B's two links go with it
    expect([...result.criticalLinkIds].sort()).toEqual(['D>E:FS']);
    // ... but the slack numbers are untouched: B still has none
    expect(result.metrics.get('B')?.totalSlack).toBe(0);
  });
});

describe('the backward pass on its own', () => {
  // Two tasks, A -> B (FS). Fed early dates that say A is already running three days late,
  // the backward pass has to work only from those, never from A's own dates.
  const chain: Task[] = [
    task('A', '06-02', '06-05'),
    task('B', '06-10', '06-12', [dep('A')]),
  ];
  const graph = buildTaskGraph(chain);

  const early = (shiftA: number, shiftB: number): Map<string, EarlyDates> =>
    new Map([
      [
        'A',
        {
          start: dayjs(`2025-06-02`).add(shiftA, 'day'),
          finish: dayjs(`2025-06-05`).add(shiftA, 'day'),
          shift: shiftA,
        },
      ],
      [
        'B',
        {
          start: dayjs(`2025-06-10`).add(shiftB, 'day'),
          finish: dayjs(`2025-06-12`).add(shiftB, 'day'),
          shift: shiftB,
        },
      ],
    ]);

  it('pins the last task to the project finish', () => {
    const late = backwardPass(chain, early(0, 0), CALENDAR_DAYS, graph);
    expect(late.get('B')?.shift).toBe(0);
    expect(late.get('B')?.finish.toISOString()).toBe(day('06-12'));
  });

  it('gives the predecessor the room its successor is not using', () => {
    // B may start as late as 06-10, and A finishes 06-05: five days of float
    const late = backwardPass(chain, early(0, 0), CALENDAR_DAYS, graph);
    expect(late.get('A')?.shift).toBe(5);
    expect(late.get('A')?.finish.toISOString()).toBe(day('06-10'));
  });

  it('takes the project finish it is handed rather than inferring one', () => {
    const late = backwardPass(
      chain,
      early(0, 0),
      CALENDAR_DAYS,
      graph,
      dayjs('2025-06-20')
    );
    expect(late.get('B')?.shift).toBe(8);
    expect(late.get('A')?.shift).toBe(13);
  });

  it('follows the early dates it is given, not the tasks own dates', () => {
    // B's early start is pushed out four days, so A gains those four days too
    const late = backwardPass(chain, early(0, 4), CALENDAR_DAYS, graph);
    expect(late.get('B')?.shift).toBe(4);
    expect(late.get('A')?.shift).toBe(9);
  });
});

describe('link types, lag and lead', () => {
  it('measures slack through an SS link', () => {
    // B starts with A + 2 days of lag; B could start as late as 06-06 without moving C
    const tasks = [
      task('A', '06-02', '06-04'),
      task('B', '06-04', '06-06', [dep('A', 'SS', 2)]),
      task('C', '06-10', '06-12', [dep('B')]),
    ];
    const { metrics } = computeCriticalPath(tasks);

    expect(metrics.get('A')?.totalSlack).toBe(4);
    expect(metrics.get('B')?.totalSlack).toBe(4);
    expect(metrics.get('C')?.totalSlack).toBe(0);
  });

  it('measures slack through an FF link with a lead', () => {
    const tasks = [
      task('A', '06-02', '06-06'),
      task('B', '06-03', '06-08', [dep('A', 'FF', -1)]),
    ];
    const { metrics } = computeCriticalPath(tasks);

    // The project ends 06-08, so B is pinned. A has to finish no later than one day
    // after B (the lead), i.e. by 06-09 - three days past its own 06-06 finish.
    expect(metrics.get('B')?.totalSlack).toBe(0);
    expect(metrics.get('A')?.totalSlack).toBe(3);
    expect(metrics.get('A')?.freeSlack).toBe(3);
  });
});

describe('working-day calendar', () => {
  const calendar = createWorkingCalendar();

  it('counts durations and slack in working days', () => {
    // A runs Thu 06-05 to Wed 06-11 - five working days, not six calendar days
    const tasks = [
      task('A', '06-05', '06-11'),
      task('B', '06-16', '06-18', [dep('A')]),
    ];
    const { metrics } = computeCriticalPath(tasks, { calendar });

    expect(metrics.get('A')?.duration).toBe(4);
    // Mon 06-16 is three working days after Wed 06-11 (Thu, Fri, Mon)
    expect(metrics.get('A')?.totalSlack).toBe(3);
    expect(metrics.get('B')?.totalSlack).toBe(0);
  });

  it('gives a weekend no slack of its own', () => {
    // Fri 06-06 to Mon 06-09 is a single working day
    const tasks = [
      task('A', '06-02', '06-06'),
      task('B', '06-09', '06-13', [dep('A')]),
    ];
    const { metrics } = computeCriticalPath(tasks, { calendar });

    expect(metrics.get('A')?.totalSlack).toBe(1);
    expect(metrics.get('A')?.duration).toBe(4);
  });
});

describe('robustness', () => {
  it('returns nothing for an empty project', () => {
    const result = computeCriticalPath([]);
    expect(result.metrics.size).toBe(0);
    expect(result.projectFinish).toBeNull();
  });

  it('reports a cycle and skips the tasks caught in it', () => {
    const result = computeCriticalPath([
      task('a', '06-02', '06-04', [dep('b')]),
      task('b', '06-02', '06-04', [dep('a')]),
      task('solo', '06-02', '06-05'),
    ]);

    expect(result.cycle).toEqual(['a', 'b']);
    expect(result.metrics.has('a')).toBe(false);
    expect(result.criticalTaskIds.has('solo')).toBe(true);
  });

  it('treats a milestone as a zero-length point', () => {
    const tasks: Task[] = [
      task('A', '06-02', '06-05'),
      { ...task('M', '06-05', '06-05'), type: 'milestone', dependencies: [dep('A')] },
      task('B', '06-05', '06-08', [dep('M')]),
    ];
    const { metrics, criticalTaskIds } = computeCriticalPath(tasks);

    expect(metrics.get('M')?.duration).toBe(0);
    expect([...criticalTaskIds].sort()).toEqual(['A', 'B', 'M']);
  });
});
