import { beforeEach, describe, expect, it } from 'vitest';
import { Task } from 'shared/task';
import dayjs from 'core/dates';
// This import is the SSR regression test: a browser global at module scope fails to load in Node.
import { createGanttStore } from './store';

let store: ReturnType<typeof createGanttStore>;

beforeEach(() => {
  store = createGanttStore();
});

describe('defaultScale seed', () => {
  it('starts at month when no scale is given', () => {
    expect(createGanttStore().getState().selectedScale).toBe('month');
  });

  // Seeded at construction, not in a mount effect, so the first paint is already at the host's scale.
  it('starts at the scale it was constructed with', () => {
    expect(createGanttStore('quarter').getState().selectedScale).toBe('quarter');
  });

  it('skips a redundant set so subscribers do not re-run', () => {
    const store = createGanttStore('week');
    const before = store.getState();

    store.getState().setSelectedScale('week');
    expect(store.getState()).toBe(before);

    store.getState().setSelectedScale('day');
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

describe('syncTasksFromProps', () => {
  const task = (id: string, startDate: string): Task => ({
    id,
    name: id,
    startDate,
    endDate: '2026-06-30',
    parentId: null,
    sequence: '1',
  });

  it('ignores a prop echo of what the chart already has', () => {
    const store = createGanttStore();
    const tasks = [task('a', '2026-06-01')];
    store.getState().setRawTasks(tasks);

    const before = store.getState();
    // The host storing what onTasksChange handed it and passing it back
    store.getState().syncTasksFromProps(tasks.map((t) => ({ ...t })));

    expect(store.getState()).toBe(before);
  });

  it('applies data the host really replaced', () => {
    const store = createGanttStore();
    store.getState().setRawTasks([task('a', '2026-06-01')]);
    store.getState().syncTasksFromProps([task('fresh', '2026-07-01')]);

    expect(store.getState().rawTasks.map((t) => t.id)).toEqual(['fresh']);
  });
});

describe('per-instance isolation', () => {
  it('keeps two charts on one page from sharing state', () => {
    const a = createGanttStore();
    const b = createGanttStore();

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

    b.getState().setSelectedScale('day');
    expect(a.getState().selectedScale).toBe('week');
  });
});

describe('selection', () => {
  it('keeps the selection identity stable when the same row is clicked twice', () => {
    expect(store.getState().selectedTaskId).toBeNull();

    store.getState().setSelectedTaskId('a1');
    const afterFirst = store.getState();

    store.getState().setSelectedTaskId('a1');
    expect(store.getState()).toBe(afterFirst);

    store.getState().setSelectedTaskId(null);
    expect(store.getState().selectedTaskId).toBeNull();
  });

});
