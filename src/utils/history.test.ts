import { describe, expect, it } from 'vitest';
import { Task } from 'types/task';
import {
  applyPatches,
  diffTasks,
  EMPTY_HISTORY,
  HistoryEntry,
  limitHistory,
  popRedo,
  popUndo,
  pushHistory,
} from './history';

const task = (id: string, start: string, end: string): Task => ({
  id,
  name: id,
  startDate: start,
  endDate: end,
  parentId: null,
  sequence: id,
});

const base: Task[] = [
  task('a', '2026-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z'),
  task('b', '2026-01-06T00:00:00.000Z', '2026-01-09T00:00:00.000Z'),
];

/** Shifts every listed task by whole days, the way a move commits */
const shiftDays = (tasks: Task[], ids: string[], days: number): Task[] =>
  tasks.map((t) =>
    ids.includes(t.id)
      ? {
          ...t,
          startDate: new Date(
            Date.parse(t.startDate) + days * 86_400_000
          ).toISOString(),
          endDate: new Date(
            Date.parse(t.endDate) + days * 86_400_000
          ).toISOString(),
        }
      : t
  );

const entryOf = (before: Task[], after: Task[]): HistoryEntry => {
  const entry = diffTasks(before, after);
  if (!entry) throw new Error('expected an invertible change');
  return entry;
};

describe('diffTasks', () => {
  it('records only the fields that changed', () => {
    const after = shiftDays(base, ['a'], 2);

    expect(diffTasks(base, after)).toEqual([
      {
        id: 'a',
        before: {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-05T00:00:00.000Z',
        },
        after: {
          startDate: '2026-01-03T00:00:00.000Z',
          endDate: '2026-01-07T00:00:00.000Z',
        },
      },
    ]);
  });

  it('records a field that only appears after the change', () => {
    const after = base.map((t) => (t.id === 'b' ? { ...t, progress: 40 } : t));

    expect(diffTasks(base, after)).toEqual([
      { id: 'b', before: { progress: undefined }, after: { progress: 40 } },
    ]);
  });

  it('produces an empty entry when nothing changed', () => {
    expect(diffTasks(base, base.map((t) => ({ ...t })))).toEqual([]);
  });

  it('reports a change it cannot invert when rows are added or replaced', () => {
    expect(
      diffTasks(base, [...base, task('c', '2026-02-01', '2026-02-02')])
    ).toBeNull();
    expect(
      diffTasks(base, [base[0], task('z', '2026-01-06', '2026-01-09')])
    ).toBeNull();
  });
});

describe('applyPatches', () => {
  it('inverts a move exactly', () => {
    const after = shiftDays(base, ['a'], 2);
    const entry = entryOf(base, after);

    expect(applyPatches(after, entry, 'before')).toEqual(base);
  });

  it('replays what undo reverted', () => {
    const after = shiftDays(base, ['a'], 2);
    const entry = entryOf(base, after);
    const undone = applyPatches(after, entry, 'before');

    expect(applyPatches(undone, entry, 'after')).toEqual(after);
  });

  it('restores every task of a subtree move in one step', () => {
    const subtree: Task[] = [
      task('root', '2026-01-01', '2026-01-20'),
      { ...task('child-1', '2026-01-01', '2026-01-08'), parentId: 'root' },
      { ...task('child-2', '2026-01-09', '2026-01-20'), parentId: 'root' },
      task('unrelated', '2026-03-01', '2026-03-04'),
    ];
    const moved = shiftDays(subtree, ['root', 'child-1', 'child-2'], 7);
    const entry = entryOf(subtree, moved);

    // One gesture, one entry - covering all three moved rows and nothing else
    expect(entry).toHaveLength(3);
    expect(applyPatches(moved, entry, 'before')).toEqual(subtree);
  });

  it('leaves tasks the step never touched alone', () => {
    const after = shiftDays(base, ['a'], 2);
    const entry = entryOf(base, after);

    expect(applyPatches(after, entry, 'before')[1]).toBe(after[1]);
  });
});

describe('pushHistory', () => {
  const step = (id: string): HistoryEntry => [
    { id, before: { progress: 0 }, after: { progress: 100 } },
  ];

  it('is not a step when the gesture changed nothing', () => {
    expect(pushHistory(EMPTY_HISTORY, [], 10)).toBe(EMPTY_HISTORY);
  });

  it('drops the redo tail when a new action branches the timeline', () => {
    const stack = { past: [step('a')], future: [step('b'), step('c')] };

    expect(pushHistory(stack, step('d'), 10)).toEqual({
      past: [step('a'), step('d')],
      future: [],
    });
  });

  it('trims the oldest steps past the configured depth', () => {
    let stack = EMPTY_HISTORY;
    for (const id of ['a', 'b', 'c', 'd']) stack = pushHistory(stack, step(id), 2);

    expect(stack.past).toEqual([step('c'), step('d')]);
  });

  it('records nothing at a depth of zero', () => {
    expect(pushHistory(EMPTY_HISTORY, step('a'), 0)).toEqual(EMPTY_HISTORY);
  });
});

describe('limitHistory', () => {
  const step = (id: string): HistoryEntry => [
    { id, before: {}, after: { progress: 1 } },
  ];

  it('drops the steps that no longer fit a smaller depth', () => {
    const stack = { past: [step('a'), step('b'), step('c')], future: [] };

    expect(limitHistory(stack, 1).past).toEqual([step('c')]);
  });

  it('leaves a stack that already fits untouched', () => {
    const stack = { past: [step('a')], future: [] };

    expect(limitHistory(stack, 5)).toBe(stack);
  });
});

describe('popUndo / popRedo', () => {
  const step = (id: string): HistoryEntry => [
    { id, before: {}, after: { progress: 1 } },
  ];

  it('returns null on an empty stack', () => {
    expect(popUndo(EMPTY_HISTORY)).toBeNull();
    expect(popRedo(EMPTY_HISTORY)).toBeNull();
  });

  it('moves the newest step across and back', () => {
    const pushed = pushHistory(
      pushHistory(EMPTY_HISTORY, step('a'), 10),
      step('b'),
      10
    );

    const undone = popUndo(pushed);
    expect(undone?.entry).toEqual(step('b'));
    expect(undone?.stack).toEqual({ past: [step('a')], future: [step('b')] });

    const redone = popRedo(undone!.stack);
    expect(redone?.entry).toEqual(step('b'));
    expect(redone?.stack).toEqual(pushed);
  });

  it('undoes repeatedly in reverse order', () => {
    let stack = EMPTY_HISTORY;
    for (const id of ['a', 'b', 'c']) stack = pushHistory(stack, step(id), 10);

    const order: string[] = [];
    for (let popped = popUndo(stack); popped; popped = popUndo(popped.stack)) {
      order.push(popped.entry[0].id);
      stack = popped.stack;
    }

    expect(order).toEqual(['c', 'b', 'a']);
    expect(stack.future).toHaveLength(3);
  });
});
