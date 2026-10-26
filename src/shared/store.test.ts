import { beforeEach, describe, expect, it } from 'vitest';
import { Task } from 'shared/task';
import type { GanttScaleKey } from 'shared/types';
import dayjs from 'core/dates';
import { createGanttStore } from './store';

let store: ReturnType<typeof createGanttStore>;

beforeEach(() => {
  store = createGanttStore();
});

describe('defaultScale seed', () => {
  it('starts at month when no scale is given', () => {
    expect(createGanttStore().getState().selectedScale).toBe('month');
  });

  it('starts at the scale it was constructed with', () => {
    expect(createGanttStore('quarter').getState().selectedScale).toBe('quarter');
  });

  it('falls back to month for a null, unknown or inherited key', () => {
    for (const scale of [null, 'weekly', 'toString']) {
      expect(
        createGanttStore(scale as unknown as GanttScaleKey).getState().selectedScale,
      ).toBe('month');
    }
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
    store.getState().syncTasksFromProps(tasks.map((t) => ({ ...t })));

    expect(store.getState()).toBe(before);
  });

  it('applies data the host really replaced', () => {
    const store = createGanttStore();
    store.getState().setRawTasks([task('a', '2026-06-01')]);
    store.getState().syncTasksFromProps([task('fresh', '2026-07-01')]);

    expect(store.getState().rawTasks.map((t) => t.id)).toEqual(['fresh']);
  });

  it('takes a task that cannot be serialized as changed instead of throwing', () => {
    const project: { tasks: Task[] } = { tasks: [] };
    const looped = { ...task('a', '2026-06-01'), project };
    project.tasks.push(looped);
    const bigint = { ...task('b', '2026-06-01'), revision: BigInt(3) };

    for (const odd of [looped, bigint]) {
      const store = createGanttStore();
      store.getState().setRawTasks([odd]);
      store.getState().syncTasksFromProps([{ ...odd }]);
      expect(store.getState().rawTasks[0]).not.toBe(odd);
    }
  });
});

describe('clearAllDragOffsets', () => {
  const node = (id: string, parentId: string | null): Task => ({
    id,
    name: id,
    startDate: '2026-03-02',
    endDate: '2026-03-20',
    parentId,
    sequence: '1',
  });
  const raw = [node('phase', null), node('a', 'phase'), node('b', 'phase'), node('other', null)];
  const offset = { offsetX: 90, offsetWidth: 0 };

  it('keeps every offset of an in-flight summary drag, and drops the rest', () => {
    const store = createGanttStore();
    store.getState().setRawTasks(raw);
    store.getState().setBarDrag({
      task: { ...raw[0], barLeft: 0, barWidth: 100, depth: 0, order: 0, originalOrder: 0, isSummary: true },
      mode: 'bar',
    });
    store.getState().setDragOffsets({ phase: offset, a: offset, b: offset, other: offset });

    store.getState().clearAllDragOffsets();

    expect(Object.keys(store.getState().dragOffsets).sort()).toEqual(['a', 'b', 'phase']);
  });

  it('drops every offset once no drag is in flight', () => {
    const store = createGanttStore();
    store.getState().setRawTasks(raw);
    store.getState().setDragOffsets({ phase: offset, a: offset });

    store.getState().clearAllDragOffsets();

    expect(store.getState().dragOffsets).toEqual({});
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
