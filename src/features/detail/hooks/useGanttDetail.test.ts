import { describe, expect, it, vi } from 'vitest';
import { createGanttStore, type GanttStoreApi } from 'shared/store';
import type { TaskTransformed } from 'shared/task';
import { resolveDetailState, useGanttDetail } from './useGanttDetail';

const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  dirty: false,
  effects: [] as (() => void)[],
  store: null as unknown,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = <T>(init: () => T): T => {
    const k = hooks.cursor++;
    if (!(k in hooks.slots)) hooks.slots[k] = init();
    return hooks.slots[k] as T;
  };
  const stale = (cell: { deps?: unknown[] }, deps: unknown[]) =>
    !cell.deps || deps.some((dep, k) => !Object.is(dep, cell.deps?.[k]));
  const memo = <T>(make: () => T, deps: unknown[]): T => {
    const cell = slot(() => ({}) as { deps?: unknown[]; value?: T });
    if (stale(cell, deps)) Object.assign(cell, { deps, value: make() });
    return cell.value as T;
  };
  return {
    ...actual,
    useContext: () => hooks.store,
    useMemo: memo,
    useCallback: <T>(fn: T, deps: unknown[]) => memo(() => fn, deps),
    useRef: <T>(current: T) => slot(() => ({ current })),
    useState: <T>(initial: T) => {
      const cell = slot(() => {
        const state = {
          value: initial,
          set: (next: T) => {
            if (Object.is(next, state.value)) return;
            state.value = next;
            hooks.dirty = true;
          },
        };
        return state;
      });
      return [cell.value, cell.set];
    },
    useEffect: (effect: () => void, deps: unknown[]) => {
      const cell = slot(() => ({}) as { deps?: unknown[] });
      if (!stale(cell, deps)) return;
      hooks.effects.push(() => {
        cell.deps = deps;
        effect();
      });
    },
  };
});

type Params = Parameters<typeof useGanttDetail>[0];
type Detail = ReturnType<typeof useGanttDetail>;

const runDetail = useGanttDetail;

function mount(store: GanttStoreApi, params: Omit<Params, 'onDetailChange'>) {
  hooks.slots = [];
  hooks.store = store;
  const log: (string | null)[] = [];
  let props: Params = {
    ...params,
    onDetailChange: (task) => void log.push(task?.id ?? null),
  };
  const render = (): Detail => {
    let detail: Detail;
    do {
      hooks.dirty = false;
      hooks.cursor = 0;
      hooks.effects = [];
      detail = runDetail(props);
    } while (hooks.dirty);
    hooks.effects.forEach((run) => run());
    return hooks.dirty ? render() : detail;
  };
  let detail = render();

  return {
    log,
    get shown() {
      return detail.task?.id ?? null;
    },
    rerender(next: Partial<Params>) {
      props = { ...props, ...next };
      detail = render();
    },
    act(fn: (detail: Detail) => void) {
      fn(detail);
      detail = render();
    },
  };
}

const task = (id: string) => ({ id }) as TaskTransformed;
const a = task('a');
const b = task('b');
const x = task('x');

function chartHolding(...tasks: TaskTransformed[]) {
  const store = createGanttStore();
  store.getState().setRawTasks(tasks);
  return { store, chart: mount(store, { enabled: true, tasks }) };
}

const tasks = [{ id: 'a' }, { id: 'b' }];

describe('resolveDetailState', () => {
  it('stays closed while the panel is off, whatever is open', () => {
    expect(
      resolveDetailState({ enabled: false, uncontrolled: 'a', tasks }),
    ).toEqual({ openId: null, task: null });
  });

  it('resolves the uncontrolled id to its task', () => {
    expect(resolveDetailState({ enabled: true, uncontrolled: 'a', tasks })).toEqual(
      { openId: 'a', task: { id: 'a' } },
    );
  });

  it('lets the controlled value win over the internal one', () => {
    expect(
      resolveDetailState({
        enabled: true,
        detailTaskId: 'b',
        uncontrolled: 'a',
        tasks,
      }),
    ).toEqual({ openId: 'b', task: { id: 'b' } });
  });

  it('treats an explicit null as controlled-and-closed', () => {
    expect(
      resolveDetailState({
        enabled: true,
        detailTaskId: null,
        uncontrolled: 'a',
        tasks,
      }),
    ).toEqual({ openId: null, task: null });
  });

  it('keeps an open id that no longer names a task, with no task to render', () => {
    expect(
      resolveDetailState({ enabled: true, uncontrolled: 'gone', tasks }),
    ).toEqual({ openId: 'gone', task: null });
  });
});

describe('openDetail', () => {
  it('opens a task the host just added, called from the host effect that first sees it', () => {
    const { store, chart } = chartHolding(a);

    store.getState().setRawTasks([a, x]);
    chart.act((detail) => detail.open('x'));
    chart.rerender({ tasks: [a, x] });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: 'x', log: ['x'] });
  });

  it('still ignores an id the chart does not hold, even once a task takes it', () => {
    const { store, chart } = chartHolding(a);

    chart.act((detail) => detail.open('x'));
    store.getState().setRawTasks([a, x]);
    chart.rerender({ tasks: [a, x] });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: [] });
  });
});

describe('a derived close', () => {
  it('stays closed when the removed task comes back', () => {
    const { chart } = chartHolding(a, b);
    chart.act((detail) => detail.open('b'));
    chart.rerender({ tasks: [a] });
    chart.rerender({ tasks: [a, b] });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: ['b'] });
  });

  it('stays closed when the panel is turned off and on again', () => {
    const { chart } = chartHolding(a, b);
    chart.act((detail) => detail.open('b'));
    chart.rerender({ enabled: false });
    chart.rerender({ enabled: true });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: ['b'] });
  });

  it('leaves closeDetail() silent, since the panel is already closed', () => {
    const { chart } = chartHolding(a, b);
    chart.act((detail) => detail.open('b'));
    chart.rerender({ tasks: [a] });
    chart.act((detail) => detail.close());
    expect(chart.log).toEqual(['b']);

    const controlled = mount(createGanttStore(), {
      enabled: true,
      tasks: [a],
      detailTaskId: 'b',
    });
    controlled.act((detail) => detail.close());
    expect(controlled.log).toEqual([]);
  });
});
