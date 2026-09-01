import { beforeEach, describe, expect, it } from 'vitest';
import dayjs from 'utils/dayjs';
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
