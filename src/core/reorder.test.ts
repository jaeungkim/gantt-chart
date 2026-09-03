import { describe, expect, it } from 'vitest';
import type { Task } from './types';
import {
  buildTaskOrder,
  moveForDrop,
  moveTask,
  sortTasksBySequence,
  validateMove,
} from './reorder';

const task = (
  id: string,
  parentId: string | null,
  sequence: string,
  extra: Partial<Task> = {},
): Task => ({
  id,
  name: id,
  startDate: '2025-01-02',
  endDate: '2025-01-03',
  parentId,
  sequence,
  ...extra,
});

// p1 (1) > a (1.1), b (1.2);  p2 (2) > c (2.1)
const nested = (): Task[] => [
  task('p1', null, '1'),
  task('a', 'p1', '1.1'),
  task('b', 'p1', '1.2'),
  task('p2', null, '2'),
  task('c', 'p2', '2.1'),
];

const flat = (): Task[] => [
  task('x', null, '1'),
  task('y', null, '2'),
  task('z', null, '3'),
];

// Rendered order, each row as "<sequence> <id>"
const layout = (tasks: Task[]) =>
  sortTasksBySequence(tasks).map((t) => `${t.sequence} ${t.id}`);

const ON = { hierarchy: true };
const OFF = { hierarchy: false };

describe('sortTasksBySequence', () => {
  it('compares segments as numbers, so 1.10 lands after 1.2', () => {
    const tasks = [task('late', null, '1.10'), task('early', null, '1.2')];
    expect(sortTasksBySequence(tasks).map((t) => t.id)).toEqual([
      'early',
      'late',
    ]);
  });
});

describe('validateMove', () => {
  it('refuses a task that is not in the data', () => {
    expect(
      validateMove(nested(), { taskId: 'nope', toParentId: null, toIndex: 0 }, ON),
    ).toBe('unknown-task');
  });

  it('refuses a parent that is not in the data', () => {
    expect(
      validateMove(nested(), { taskId: 'a', toParentId: 'nope', toIndex: 0 }, ON),
    ).toBe('unknown-parent');
  });

  it('refuses a task the host has frozen', () => {
    expect(
      validateMove(nested(), { taskId: 'a', toParentId: 'p2', toIndex: 0 }, {
        ...ON,
        canReorder: (t) => t.id !== 'a',
      }),
    ).toBe('read-only');
  });

  it('refuses dropping a task inside its own subtree', () => {
    expect(
      validateMove(nested(), { taskId: 'p1', toParentId: 'a', toIndex: 0 }, ON),
    ).toBe('cycle');
  });

  it('refuses dropping a task onto itself', () => {
    expect(
      validateMove(nested(), { taskId: 'p1', toParentId: 'p1', toIndex: 0 }, ON),
    ).toBe('cycle');
  });

  it('refuses a re-parent while hierarchy is off', () => {
    expect(
      validateMove(nested(), { taskId: 'a', toParentId: 'p2', toIndex: 0 }, OFF),
    ).toBe('reparent-disabled');
  });

  it('refuses a drop that would cross a group band', () => {
    const groups: Record<string, string> = { p1: 'left', p2: 'right' };
    expect(
      validateMove(nested(), { taskId: 'a', toParentId: 'p2', toIndex: 0 }, {
        ...ON,
        groupOf: (t) => groups[t.id] ?? '',
      }),
    ).toBe('cross-group');
  });

  it('allows a drop inside the same group band', () => {
    expect(
      validateMove(nested(), { taskId: 'b', toParentId: 'a', toIndex: 0 }, {
        ...ON,
        groupOf: () => 'one',
      }),
    ).toBeNull();
  });

  it('refuses a drop that changes nothing', () => {
    expect(
      validateMove(nested(), { taskId: 'a', toParentId: 'p1', toIndex: 0 }, ON),
    ).toBe('no-op');
  });

  it('allows a legal re-parent', () => {
    expect(
      validateMove(nested(), { taskId: 'c', toParentId: 'p1', toIndex: 2 }, ON),
    ).toBeNull();
  });
});

describe('moveTask', () => {
  it('returns null for a move that is refused', () => {
    expect(
      moveTask(nested(), { taskId: 'p1', toParentId: 'a', toIndex: 0 }, ON),
    ).toBeNull();
  });

  it('re-parents and renumbers both sibling lists', () => {
    const result = moveTask(
      nested(),
      { taskId: 'c', toParentId: 'p1', toIndex: 1 },
      ON,
    );

    expect(layout(result!.tasks)).toEqual([
      '1 p1',
      '1.1 a',
      '1.2 c',
      '1.3 b',
      '2 p2',
    ]);
    expect(result!.tasks.find((t) => t.id === 'c')?.parentId).toBe('p1');
  });

  it('reports the move in both index and sibling terms', () => {
    const result = moveTask(
      nested(),
      { taskId: 'c', toParentId: 'p1', toIndex: 1 },
      ON,
    );

    expect(result!.change).toEqual({
      taskId: 'c',
      fromParentId: 'p2',
      fromIndex: 0,
      toParentId: 'p1',
      toIndex: 1,
      afterId: 'a',
      beforeId: 'b',
    });
  });

  it('carries the whole subtree along', () => {
    const result = moveTask(
      nested(),
      { taskId: 'p2', toParentId: 'p1', toIndex: 0 },
      ON,
    );

    expect(layout(result!.tasks)).toEqual([
      '1 p1',
      '1.1 p2',
      '1.1.1 c',
      '1.2 a',
      '1.3 b',
    ]);
    // Only the moved task's parent link is rewritten; c still hangs off p2
    expect(result!.tasks.find((t) => t.id === 'c')?.parentId).toBe('p2');
  });

  it('promotes a task to the root level', () => {
    const result = moveTask(
      nested(),
      { taskId: 'a', toParentId: null, toIndex: 0 },
      ON,
    );

    expect(layout(result!.tasks)).toEqual(['1 a', '2 p1', '2.1 b', '3 p2', '3.1 c']);
    expect(result!.tasks.find((t) => t.id === 'a')?.parentId).toBeNull();
  });

  it('keeps the identity of tasks whose path did not change', () => {
    const before = nested();
    const result = moveTask(
      before,
      { taskId: 'c', toParentId: 'p1', toIndex: 2 },
      ON,
    );

    const untouched = ['p1', 'a', 'b'];
    for (const id of untouched) {
      expect(result!.tasks.find((t) => t.id === id)).toBe(
        before.find((t) => t.id === id),
      );
    }
  });

  it('reorders flat data with hierarchy off', () => {
    const result = moveTask(
      flat(),
      { taskId: 'z', toParentId: null, toIndex: 0 },
      OFF,
    );

    expect(layout(result!.tasks)).toEqual(['1 z', '2 x', '3 y']);
  });

  it('reads depth off the sequence path when hierarchy is off', () => {
    // parentId is absent, so "1.2" is a child of "1" by its path alone
    const tasks = [
      task('p', null, '1'),
      task('one', null, '1.1'),
      task('two', null, '1.2'),
    ];

    const result = moveTask(
      tasks,
      { taskId: 'two', toParentId: 'p', toIndex: 0 },
      OFF,
    );

    expect(layout(result!.tasks)).toEqual(['1 p', '1.1 two', '1.2 one']);
    // Nothing re-parented, so parentId is left exactly as the host had it
    expect(result!.tasks.every((t) => t.parentId === null)).toBe(true);
  });

  it('clamps an index past the end of the sibling list', () => {
    const result = moveTask(
      nested(),
      { taskId: 'c', toParentId: 'p1', toIndex: 99 },
      ON,
    );

    expect(layout(result!.tasks)).toEqual([
      '1 p1',
      '1.1 a',
      '1.2 b',
      '1.3 c',
      '2 p2',
    ]);
    expect(result!.change.toIndex).toBe(2);
    expect(result!.change.beforeId).toBeNull();
  });

  it('moves a task down among its own siblings', () => {
    const tasks = [
      task('p', null, '1'),
      task('one', 'p', '1.1'),
      task('two', 'p', '1.2'),
      task('three', 'p', '1.3'),
    ];

    const result = moveTask(
      tasks,
      { taskId: 'one', toParentId: 'p', toIndex: 2 },
      ON,
    );

    expect(layout(result!.tasks)).toEqual([
      '1 p',
      '1.1 two',
      '1.2 three',
      '1.3 one',
    ]);
    expect(result!.change).toMatchObject({
      fromIndex: 0,
      toIndex: 2,
      afterId: 'three',
      beforeId: null,
    });
  });
});

describe('buildTaskOrder', () => {
  it('reads sibling lists off parentId when hierarchy is on', () => {
    const order = buildTaskOrder(nested(), true);

    expect(order.childrenOf(null)).toEqual(['p1', 'p2']);
    expect(order.childrenOf('p1')).toEqual(['a', 'b']);
    expect(order.parentOf.get('c')).toBe('p2');
  });

  it('reads them off the sequence path when hierarchy is off', () => {
    // parentId is null everywhere, so only the path says who is whose child
    const tasks = [
      task('p', null, '1'),
      task('one', null, '1.1'),
      task('two', null, '1.2'),
    ];
    const order = buildTaskOrder(tasks, false);

    expect(order.childrenOf(null)).toEqual(['p']);
    expect(order.childrenOf('p')).toEqual(['one', 'two']);
  });

  it('hands back an empty list for a parent with no children', () => {
    expect(buildTaskOrder(nested(), true).childrenOf('a')).toEqual([]);
  });
});

describe('moveForDrop', () => {
  const order = () => buildTaskOrder(nested(), true);

  it('drops before a row as its sibling', () => {
    expect(moveForDrop(order(), 'c', 'b', 'before')).toEqual({
      taskId: 'c',
      toParentId: 'p1',
      toIndex: 1,
    });
  });

  it('drops after a row as its sibling', () => {
    expect(moveForDrop(order(), 'c', 'a', 'after')).toEqual({
      taskId: 'c',
      toParentId: 'p1',
      toIndex: 1,
    });
  });

  it('drops onto a row as its last child', () => {
    expect(moveForDrop(order(), 'c', 'p1', 'child')).toEqual({
      taskId: 'c',
      toParentId: 'p1',
      toIndex: 2,
    });
  });

  it('gives up the slot it vacates when travelling down its own list', () => {
    // a is at 0; dropping it after b must be index 1 of [b], not 2 of [a, b]
    expect(moveForDrop(order(), 'a', 'b', 'after')).toEqual({
      taskId: 'a',
      toParentId: 'p1',
      toIndex: 1,
    });
  });

  it('keeps the slot when travelling up its own list', () => {
    expect(moveForDrop(order(), 'b', 'a', 'before')).toEqual({
      taskId: 'b',
      toParentId: 'p1',
      toIndex: 0,
    });
  });

  it('appends into its own parent without counting itself twice', () => {
    // a is already a child of p1, so "last child" is index 1 of [b], not 2
    expect(moveForDrop(order(), 'a', 'p1', 'child')).toEqual({
      taskId: 'a',
      toParentId: 'p1',
      toIndex: 1,
    });
  });

  it('describes a drop the core will refuse, and leaves the refusing to it', () => {
    const move = moveForDrop(order(), 'p1', 'a', 'child');

    expect(move).toEqual({ taskId: 'p1', toParentId: 'a', toIndex: 0 });
    expect(validateMove(nested(), move, ON)).toBe('cycle');
  });

  it('produces indices moveTask lands exactly on', () => {
    const move = moveForDrop(order(), 'c', 'a', 'after');

    expect(layout(moveTask(nested(), move, ON)!.tasks)).toEqual([
      '1 p1',
      '1.1 a',
      '1.2 c',
      '1.3 b',
      '2 p2',
    ]);
  });
});
