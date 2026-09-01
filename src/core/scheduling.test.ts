import { describe, expect, it, vi } from 'vitest';
import { CALENDAR_DAYS } from './calendar';
import {
  buildTaskGraph,
  canLink,
  findPath,
  linkDelta,
  linkKey,
  scheduleTasks,
  type SchedulingPolicy,
} from './scheduling';
import type { DependencyType, Task, TaskDependency } from './types';

// Bare dates parse as UTC midnight, so a task written '06-02'..'06-05' is exactly three
// days long and every assertion below is a whole-day comparison.
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

const dep = (
  targetId: string,
  type: DependencyType,
  lag?: number
): TaskDependency => (lag === undefined ? { targetId, type } : { targetId, type, lag });

/** 'MM-DD' of a task's start and end, for readable assertions */
const span = (tasks: Task[], id: string) => {
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no task ${id}`);
  return [found.startDate.slice(5, 10), found.endDate.slice(5, 10)].join('..');
};

const run = (tasks: Task[], policy: SchedulingPolicy = 'shift-on-overlap') =>
  scheduleTasks(tasks, { policy });

describe('buildTaskGraph', () => {
  it('orders predecessors before successors', () => {
    const graph = buildTaskGraph([
      task('c', '06-10', '06-12', [dep('b', 'FS')]),
      task('a', '06-02', '06-04'),
      task('b', '06-05', '06-07', [dep('a', 'FS')]),
    ]);

    expect(graph.cycle).toBeNull();
    expect(graph.order.indexOf('a')).toBeLessThan(graph.order.indexOf('b'));
    expect(graph.order.indexOf('b')).toBeLessThan(graph.order.indexOf('c'));
  });

  it('drops self-links and links to tasks that are not in the data', () => {
    const graph = buildTaskGraph([
      task('a', '06-02', '06-04', [dep('a', 'FS'), dep('ghost', 'FS')]),
    ]);

    expect(graph.links).toEqual([]);
    expect(graph.order).toEqual(['a']);
  });

  it('reports the tasks caught in a cycle instead of ordering them', () => {
    const graph = buildTaskGraph([
      task('a', '06-02', '06-04', [dep('c', 'FS')]),
      task('b', '06-05', '06-07', [dep('a', 'FS')]),
      task('c', '06-08', '06-10', [dep('b', 'FS')]),
      task('free', '06-02', '06-03'),
    ]);

    expect(graph.order).toEqual(['free']);
    expect(graph.cycle).toEqual(['a', 'b', 'c']);
  });
});

describe('linkDelta - every link type, with lag and lead', () => {
  // a runs 06-02..06-05, b runs 06-03..06-05 and is always in the wrong place to start with
  const a = task('a', '06-02', '06-05');
  const b = task('b', '06-03', '06-05');

  const delta = (type: DependencyType, lag = 0) =>
    linkDelta(
      { predecessorId: 'a', successorId: 'b', type, lag },
      a,
      b,
      CALENDAR_DAYS
    );

  it('FS pins the successor start to the predecessor finish', () => {
    expect(delta('FS')).toBe(2); // b.start 06-03 -> 06-05
    expect(delta('FS', 2)).toBe(4); // -> 06-07
    expect(delta('FS', -1)).toBe(1); // lead: -> 06-04
  });

  it('SS pins the successor start to the predecessor start', () => {
    expect(delta('SS')).toBe(-1); // b.start 06-03 -> 06-02
    expect(delta('SS', 3)).toBe(2); // -> 06-05
    expect(delta('SS', -2)).toBe(-3); // -> 05-31
  });

  it('FF pins the successor finish to the predecessor finish', () => {
    expect(delta('FF')).toBe(0); // b.end 06-05 already equals a.end
    expect(delta('FF', 1)).toBe(1);
    expect(delta('FF', -4)).toBe(-4);
  });

  it('SF pins the successor finish to the predecessor start', () => {
    expect(delta('SF')).toBe(-3); // b.end 06-05 -> 06-02
    expect(delta('SF', 5)).toBe(2); // -> 06-07
    expect(delta('SF', -1)).toBe(-4); // -> 06-01
  });
});

describe('scheduleTasks', () => {
  it('is a no-op under the default policy', () => {
    const tasks = [
      task('a', '06-02', '06-05'),
      task('b', '06-01', '06-03', [dep('a', 'FS')]),
    ];

    const result = scheduleTasks(tasks);
    expect(result.tasks).toBe(tasks); // same array instance - nothing to re-render
    expect(result.movedIds).toEqual([]);
  });

  it('lands the successor exactly on each link type under maintain-gap', () => {
    // a runs 06-02..06-05, b is two days long and starts out at 06-03..06-05
    const cases: [DependencyType, number, string][] = [
      ['FS', 0, '06-05..06-07'], // start pinned to a's finish
      ['FS', 2, '06-07..06-09'], // + two days of lag
      ['FS', -1, '06-04..06-06'], // one day of lead
      ['SS', 0, '06-02..06-04'], // start pinned to a's start
      ['SS', 3, '06-05..06-07'],
      ['FF', 0, '06-03..06-05'], // finish pinned to a's finish
      ['FF', 1, '06-04..06-06'],
      ['FF', -4, '05-30..06-01'],
      ['SF', 0, '05-31..06-02'], // finish pinned to a's start
      ['SF', 5, '06-05..06-07'],
    ];

    for (const [type, lag, expected] of cases) {
      const result = scheduleTasks(
        [
          task('a', '06-02', '06-05'),
          task('b', '06-03', '06-05', [dep('a', type, lag)]),
        ],
        { policy: 'maintain-gap' }
      );
      expect(`${type}${lag >= 0 ? '+' : ''}${lag} ${span(result.tasks, 'b')}`).toBe(
        `${type}${lag >= 0 ? '+' : ''}${lag} ${expected}`
      );
    }
  });

  it('shift-on-overlap only ever pushes later', () => {
    // b sits well after a with an SS link - the gap is legal, so nothing moves
    const result = run([
      task('a', '06-02', '06-05'),
      task('b', '06-20', '06-22', [dep('a', 'SS')]),
    ]);
    expect(result.movedIds).toEqual([]);
  });

  it('maintain-gap pulls a successor back to the link', () => {
    const result = run(
      [
        task('a', '06-02', '06-05'),
        task('b', '06-20', '06-22', [dep('a', 'FS', 1)]),
      ],
      'maintain-gap'
    );
    expect(span(result.tasks, 'b')).toBe('06-06..06-08');
    expect(result.movedIds).toEqual(['b']);
  });

  it('carries a move down a chain', () => {
    const result = run([
      task('a', '06-02', '06-05'),
      task('b', '06-03', '06-06', [dep('a', 'FS')]),
      task('c', '06-04', '06-05', [dep('b', 'FS')]),
    ]);

    expect(span(result.tasks, 'b')).toBe('06-05..06-08');
    expect(span(result.tasks, 'c')).toBe('06-08..06-09');
    expect(result.movedIds).toEqual(['b', 'c']);
  });

  it('takes the binding predecessor when two paths converge', () => {
    // a -> b -> d and a -> c -> d; c finishes later, so it is what holds d
    const result = run([
      task('a', '06-02', '06-04'),
      task('b', '06-04', '06-06', [dep('a', 'FS')]),
      task('c', '06-04', '06-09', [dep('a', 'FS')]),
      task('d', '06-05', '06-07', [dep('b', 'FS'), dep('c', 'FS')]),
    ]);

    expect(span(result.tasks, 'b')).toBe('06-04..06-06');
    expect(span(result.tasks, 'c')).toBe('06-04..06-09');
    expect(span(result.tasks, 'd')).toBe('06-09..06-11');
  });

  it('respects positive lag and negative lead down a chain', () => {
    const withLag = run([
      task('a', '06-02', '06-05'),
      task('b', '06-02', '06-04', [dep('a', 'FS', 3)]),
    ]);
    expect(span(withLag.tasks, 'b')).toBe('06-08..06-10');

    const withLead = run([
      task('a', '06-02', '06-05'),
      task('b', '06-02', '06-04', [dep('a', 'FS', -2)]),
    ]);
    expect(span(withLead.tasks, 'b')).toBe('06-03..06-05');
  });

  it('never moves a manually scheduled task, but still schedules past it', () => {
    const tasks: Task[] = [
      task('a', '06-02', '06-05'),
      { ...task('b', '06-02', '06-04', [dep('a', 'FS')]), manuallyScheduled: true },
      task('c', '06-02', '06-03', [dep('b', 'FS')]),
    ];

    const result = run(tasks);
    expect(span(result.tasks, 'b')).toBe('06-02..06-04'); // pinned
    expect(span(result.tasks, 'c')).toBe('06-04..06-05'); // still follows b
    expect(result.movedIds).toEqual(['c']);
  });

  it('reports a cycle, leaves it alone and returns', () => {
    const onCycle = vi.fn();
    const result = scheduleTasks(
      [
        task('a', '06-02', '06-04', [dep('c', 'FS')]),
        task('b', '06-02', '06-04', [dep('a', 'FS')]),
        task('c', '06-02', '06-04', [dep('b', 'FS')]),
        task('x', '06-02', '06-05'),
        task('y', '06-02', '06-03', [dep('x', 'FS')]),
      ],
      { policy: 'shift-on-overlap', onCycle }
    );

    expect(result.cycle).toEqual(['a', 'b', 'c']);
    expect(onCycle).toHaveBeenCalledWith(['a', 'b', 'c']);
    // the acyclic part still schedules
    expect(span(result.tasks, 'y')).toBe('06-05..06-06');
    expect(span(result.tasks, 'a')).toBe('06-02..06-04');
  });

  it('only touches what the seeds reach', () => {
    const result = scheduleTasks(
      [
        task('a', '06-02', '06-05'),
        task('b', '06-02', '06-04', [dep('a', 'FS')]),
        task('x', '06-02', '06-05'),
        task('y', '06-02', '06-04', [dep('x', 'FS')]),
      ],
      { policy: 'shift-on-overlap', seeds: ['a'] }
    );

    expect(result.movedIds).toEqual(['b']);
    expect(span(result.tasks, 'y')).toBe('06-02..06-04');
  });

  it('leaves the seed itself where the caller put it', () => {
    // a is dragged on top of its own predecessor - the drag wins
    const result = scheduleTasks(
      [
        task('p', '06-10', '06-12'),
        task('a', '06-02', '06-04', [dep('p', 'FS')]),
      ],
      { policy: 'shift-on-overlap', seeds: ['a'] }
    );
    expect(result.movedIds).toEqual([]);
  });

  it('treats a milestone as a single point at its start date', () => {
    const tasks: Task[] = [
      { ...task('m', '06-05', '06-05'), type: 'milestone' },
      task('b', '06-02', '06-04', [dep('m', 'FS')]),
    ];

    expect(span(run(tasks).tasks, 'b')).toBe('06-05..06-07');
  });

  it('pins summary rows when hierarchy is on', () => {
    const tasks: Task[] = [
      task('a', '06-02', '06-05'),
      { ...task('parent', '06-02', '06-06', [dep('a', 'FS')]), parentId: null },
      { ...task('child', '06-02', '06-06'), parentId: 'parent' },
    ];

    expect(scheduleTasks(tasks, { policy: 'shift-on-overlap', hierarchy: true }).movedIds)
      .toEqual([]);
    expect(scheduleTasks(tasks, { policy: 'shift-on-overlap' }).movedIds)
      .toEqual(['parent']);
  });
});

describe('cycle prevention at link-creation time', () => {
  const chain = [
    task('a', '06-02', '06-04'),
    task('b', '06-05', '06-07', [dep('a', 'FS')]),
    task('c', '06-08', '06-10', [dep('b', 'FS')]),
  ];

  it('allows a link that keeps the graph acyclic', () => {
    expect(canLink(chain, 'a', 'c')).toEqual({ ok: true, cycle: null });
  });

  it('rejects a link that closes a loop, and names the chain', () => {
    expect(canLink(chain, 'c', 'a')).toEqual({
      ok: false,
      cycle: ['a', 'b', 'c', 'a'],
    });
  });

  it('rejects a self-link', () => {
    expect(canLink(chain, 'a', 'a')).toEqual({ ok: false, cycle: ['a', 'a'] });
  });

  it('finds the path a cycle would close', () => {
    expect(findPath(chain, 'a', 'c')).toEqual(['a', 'b', 'c']);
    expect(findPath(chain, 'c', 'a')).toBeNull();
  });
});

describe('linkKey', () => {
  it('is stable per link', () => {
    expect(
      linkKey({ predecessorId: 'a', successorId: 'b', type: 'FS', lag: 0 })
    ).toBe('a>b:FS');
  });
});
