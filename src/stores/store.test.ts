import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GanttBeforeChangeHandler } from 'types/gantt';
import { Task } from 'types/task';
import dayjs from 'core/dates';
import { buildTaskChange, mutationKey } from 'utils/mutation';
// This import is itself the SSR-safety regression test - touching sessionStorage at
// module scope would make loading the file fail outright in a Node environment (no jsdom).
import { createGanttStore, readPersistedScale } from './store';

// Node has no sessionStorage, so a minimal stub is installed and the writes are counted
const writes: Array<[string, string]> = [];
const stubSessionStorage = () => {
  const data = new Map<string, string>();
  writes.length = 0;
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes.push([key, value]);
        data.set(key, value);
      },
      removeItem: (key: string) => data.delete(key),
    },
  });
  return data;
};

// A fresh store per instance - tests do not share state
let store: ReturnType<typeof createGanttStore>;

beforeEach(() => {
  store = createGanttStore();
});

describe('readPersistedScale', () => {
  it('returns null when nothing is stored', () => {
    stubSessionStorage();
    expect(readPersistedScale()).toBeNull();
  });

  it('returns the stored scale', () => {
    stubSessionStorage().set('gantt-scale', 'week');
    expect(readPersistedScale()).toBe('week');
  });

  it('ignores an unknown stored value', () => {
    stubSessionStorage().set('gantt-scale', 'fortnight');
    expect(readPersistedScale()).toBeNull();
  });

  it('returns null instead of throwing when sessionStorage is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
    expect(readPersistedScale()).toBeNull();
  });
});

describe('setSelectedScale persistence', () => {
  it('writes the scale once and skips a redundant write', () => {
    stubSessionStorage();

    store.getState().setSelectedScale('week');
    store.getState().setSelectedScale('week');

    expect(store.getState().selectedScale).toBe('week');
    expect(writes).toEqual([['gantt-scale', 'week']]);
    expect(readPersistedScale()).toBe('week');
  });

  it('does not write on drag updates', () => {
    stubSessionStorage();

    for (let i = 0; i < 50; i++) {
      store.getState().setDragOffsets({
        t1: {
          offsetX: i,
          offsetWidth: 0,
          offsetStartDate: dayjs('2025-01-01'),
          offsetEndDate: dayjs('2025-01-02'),
        },
      });
    }
    store.getState().clearAllDragOffsets();
    store.getState().setRawTasks([]);

    expect(writes).toEqual([]);
  });

  it('survives an unavailable sessionStorage', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');

    expect(() => store.getState().setSelectedScale('day')).not.toThrow();
    expect(store.getState().selectedScale).toBe('day');
  });
});

describe('setRawTasks', () => {
  it('accepts an empty array so the chart can be cleared', () => {
    store.setState({
      rawTasks: [
        {
          id: 'a',
          name: 'a',
          startDate: '2025-01-01',
          endDate: '2025-01-02',
          parentId: null,
          sequence: '1',
        },
      ],
    });

    store.getState().setRawTasks([]);

    expect(store.getState().rawTasks).toEqual([]);
  });
});

describe('undo history', () => {
  const task = (id: string, start: string, parentId: string | null = null) => ({
    id,
    name: id,
    startDate: start,
    endDate: start,
    parentId,
    sequence: id,
  });

  const subtree = [
    task('root', '2026-01-01'),
    task('child-1', '2026-01-01', 'root'),
    task('child-2', '2026-01-05', 'root'),
    task('other', '2026-03-01'),
  ];

  /** What a subtree move commits: every member rewritten in one array */
  const movedSubtree = subtree.map((t) =>
    t.id === 'other' ? t : { ...t, startDate: '2026-02-01', endDate: '2026-02-01' }
  );

  // The dependency gestures (drawing a link, deleting an arrow) commit the same way a
  // drag does, so an edited `dependencies` array is one undo step like any other
  it('undoes a dependency change committed as one gesture', () => {
    const linked = subtree.map((t) =>
      t.id === 'child-2'
        ? { ...t, dependencies: [{ targetId: 'child-1', type: 'FS' as const }] }
        : t
    );

    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(linked);
    expect(store.getState().history.past).toHaveLength(1);

    expect(store.getState().undo()).toEqual(subtree);
    expect(store.getState().redo()).toEqual(linked);
  });

  it('records nothing until a gesture happens', () => {
    store.getState().setRawTasks(subtree);

    expect(store.getState().history).toEqual({ past: [], future: [] });
    expect(store.getState().undo()).toBeNull();
    expect(store.getState().redo()).toBeNull();
  });

  it('groups one gesture into one step, however many tasks it moved', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(movedSubtree);

    expect(store.getState().history.past).toHaveLength(1);

    const undone = store.getState().undo();
    expect(undone).toEqual(subtree);
    expect(store.getState().rawTasks).toEqual(subtree);
    expect(store.getState().history.past).toHaveLength(0);

    expect(store.getState().redo()).toEqual(movedSubtree);
    expect(store.getState().rawTasks).toEqual(movedSubtree);
  });

  it('does not record a gesture that changed nothing', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(subtree.map((t) => ({ ...t })));

    expect(store.getState().history.past).toEqual([]);
  });

  it('keeps only the configured number of steps', () => {
    store.getState().setHistoryLimit(2);
    store.getState().setRawTasks(subtree);

    for (const day of ['02', '03', '04', '05']) {
      store
        .getState()
        .commitTasks(
          store
            .getState()
            .rawTasks.map((t) =>
              t.id === 'other' ? { ...t, startDate: `2026-03-${day}` } : t
            )
        );
    }

    expect(store.getState().history.past).toHaveLength(2);

    store.getState().undo();
    store.getState().undo();
    expect(store.getState().undo()).toBeNull();
    // Only the two steps that fit came back - the older ones are gone for good
    expect(
      store.getState().rawTasks.find((t) => t.id === 'other')?.startDate
    ).toBe('2026-03-03');
  });

  it('drops the redo tail when a new gesture branches the timeline', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(movedSubtree);
    store.getState().undo();

    expect(store.getState().history.future).toHaveLength(1);

    store
      .getState()
      .commitTasks(
        subtree.map((t) =>
          t.id === 'other' ? { ...t, startDate: '2026-04-01' } : t
        )
      );

    expect(store.getState().history.future).toEqual([]);
    expect(store.getState().redo()).toBeNull();
  });

  it('ignores a prop echo of what the chart already has', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(movedSubtree);

    // The host storing what onTasksChange handed it and passing it back
    store.getState().syncTasksFromProps(movedSubtree.map((t) => ({ ...t })));

    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().undo()).toEqual(subtree);
  });

  it('clears the history when the host replaces the data', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(movedSubtree);

    store.getState().syncTasksFromProps([task('fresh', '2026-06-01')]);

    expect(store.getState().history).toEqual({ past: [], future: [] });
    expect(store.getState().undo()).toBeNull();
  });

  it('drops the history rather than record a step it cannot invert', () => {
    store.getState().setRawTasks(subtree);
    store.getState().commitTasks(movedSubtree);
    store.getState().commitTasks(movedSubtree.slice(1));

    expect(store.getState().history).toEqual({ past: [], future: [] });
  });
});

/**
 * How the undo stack composes with the before-change gate.
 *
 * These mirror what the drag hooks do on drop: build the change, ask the gate, and on
 * 'commit' merge into `rawTasks` as they are *then* and hand that to `commitTasks`.
 * History therefore records what actually reached the data, and nothing else.
 */
describe('undo history under a cancellable change', () => {
  const task = (id: string, start: string): Task => ({
    id,
    name: id,
    startDate: start,
    endDate: start,
    parentId: null,
    sequence: id,
  });

  const initial = [task('a', '2026-01-01'), task('b', '2026-02-01')];
  const moved = (tasks: Task[], id: string, start: string) =>
    tasks.map((t) => (t.id === id ? { ...t, startDate: start } : t));

  /** The drop path of a drag, gate and all - the same shape both hooks use */
  const drop = async (
    id: string,
    start: string,
    handler: GanttBeforeChangeHandler
  ) => {
    const previous = store.getState().rawTasks;
    const next = moved(previous, id, start);
    const change = buildTaskChange({
      type: 'move',
      taskId: id,
      changedIds: [id],
      previous,
      next,
    });
    const key = mutationKey('move', id);
    const token = store.getState().mutationGate.begin(key);

    const outcome = await store
      .getState()
      .mutationGate.settle(key, token, handler, change);

    if (outcome === 'commit') {
      const edited = new Map(change.changedTasks.map((t) => [t.id, t]));
      store
        .getState()
        .commitTasks(store.getState().rawTasks.map((t) => edited.get(t.id) ?? t));
    }
    return outcome;
  };

  const approve: GanttBeforeChangeHandler = () => undefined;
  const veto: GanttBeforeChangeHandler = () => false;

  beforeEach(() => {
    store.getState().setRawTasks(initial);
  });

  it('records one step for an approved change', async () => {
    expect(await drop('a', '2026-03-01', approve)).toBe('commit');

    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().undo()).toEqual(initial);
  });

  it('records nothing for a vetoed change', async () => {
    expect(await drop('a', '2026-03-01', veto)).toBe('rollback');

    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().rawTasks).toEqual(initial);
    expect(store.getState().undo()).toBeNull();
  });

  it('records nothing for a change a throwing handler rolled back', async () => {
    expect(
      await drop('a', '2026-03-01', () => {
        throw new Error('server said no');
      })
    ).toBe('rollback');

    expect(store.getState().history.past).toEqual([]);
  });

  it('records nothing for an answer a newer gesture superseded', async () => {
    // The second gesture claims the lane while the first handler is still thinking
    const stale = drop('a', '2026-03-01', async () => {
      store.getState().mutationGate.begin(mutationKey('move', 'a'));
      return undefined;
    });

    expect(await stale).toBe('stale');
    expect(store.getState().history.past).toEqual([]);
    expect(store.getState().rawTasks).toEqual(initial);
  });

  it('diffs a late answer against the data at commit time, not at drop', async () => {
    // A slow handler on `a`, with a second bar committing while it is in flight
    let release: () => void = () => {};
    const pending = drop(
      'a',
      '2026-03-01',
      () => new Promise<void>((resolve) => (release = resolve))
    );

    await drop('b', '2026-04-01', approve);
    release();
    expect(await pending).toBe('commit');

    // Two gestures, two steps - and `a`'s step knows nothing about `b`
    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().history.past[1]).toEqual([
      {
        id: 'a',
        before: { startDate: '2026-01-01' },
        after: { startDate: '2026-03-01' },
      },
    ]);

    // Undoing `a` must leave `b`'s edit alone - diffing against the drop-time snapshot
    // would have carried b's old date along and reverted it too
    expect(store.getState().undo()).toEqual(
      moved(initial, 'b', '2026-04-01')
    );
  });

  it('does not re-enter the before-change handler on undo or redo', async () => {
    const handler = vi.fn(approve);
    await drop('a', '2026-03-01', handler);
    expect(handler).toHaveBeenCalledTimes(1);

    // Undo restores a state the host already accepted, so it is not offered for veto -
    // a veto there would pop the step without restoring the data and strand the stack
    store.getState().undo();
    store.getState().redo();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.getState().rawTasks).toEqual(moved(initial, 'a', '2026-03-01'));
  });
});

describe('per-instance isolation', () => {
  it('keeps two charts on one page from sharing state', () => {
    stubSessionStorage();

    const a = createGanttStore('gantt-scale-a');
    const b = createGanttStore('gantt-scale-b');

    a.getState().setSelectedScale('week');
    a.getState().setRawTasks([
      {
        id: 'a1',
        name: 'a1',
        startDate: '2025-01-01',
        endDate: '2025-01-02',
        parentId: null,
        sequence: '1',
      },
    ]);
    a.getState().setDragOffsets({
      a1: {
        offsetX: 12,
        offsetWidth: 0,
        offsetStartDate: dayjs('2025-01-01'),
        offsetEndDate: dayjs('2025-01-02'),
      },
    });

    expect(b.getState().selectedScale).toBe('month');
    expect(b.getState().rawTasks).toEqual([]);
    expect(b.getState().dragOffsets).toEqual({});

    // Scale persistence is separated by the per-instance key too
    b.getState().setSelectedScale('day');
    expect(readPersistedScale('gantt-scale-a')).toBe('week');
    expect(readPersistedScale('gantt-scale-b')).toBe('day');
  });
});

describe('selection and revert flags', () => {
  it('keeps the selection identity stable when the same row is clicked twice', () => {
    expect(store.getState().selectedTaskId).toBeNull();

    store.getState().setSelectedTaskId('a1');
    const afterFirst = store.getState();

    store.getState().setSelectedTaskId('a1');
    expect(store.getState()).toBe(afterFirst);

    store.getState().setSelectedTaskId(null);
    expect(store.getState().selectedTaskId).toBeNull();
  });

  it('marks a whole subtree as reverting without duplicating ids', () => {
    store.getState().beginRevert(['a1', 'a2']);
    store.getState().beginRevert(['a2', 'a3']);
    expect(store.getState().revertingIds).toEqual(['a1', 'a2', 'a3']);

    store.getState().endRevert(['a2']);
    expect(store.getState().revertingIds).toEqual(['a1', 'a3']);

    // A clear that removes nothing leaves the state object alone
    const unchanged = store.getState();
    store.getState().endRevert(['nope']);
    expect(store.getState()).toBe(unchanged);
  });

  it('gives every chart its own pending-mutation gate', () => {
    const other = createGanttStore('gantt-scale-other');

    expect(store.getState().mutationGate.begin('dates:a1')).toBe(1);
    expect(store.getState().mutationGate.begin('dates:a1')).toBe(2);
    expect(other.getState().mutationGate.begin('dates:a1')).toBe(1);
  });
});
