// @vitest-environment happy-dom
import {
  act,
  createElement,
  createRef,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Gantt from 'Gantt';
import type { Task } from 'core/types';
import { click, render } from 'shared/testing/dom';
import { resolveDetailState } from './useGanttDetail';

type GanttProps = ComponentProps<typeof Gantt>;
type GanttHandle = ComponentRef<typeof Gantt>;

const task = (id: string, sequence: string): Task => ({
  id,
  name: id.toUpperCase(),
  startDate: '2025-01-01',
  endDate: '2025-01-05',
  parentId: null,
  sequence,
});
const a = task('a', '1');
const b = task('b', '2');
const x = task('x', '3');

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const settle = () => act(async () => vi.advanceTimersByTime(1000));

const shown = (host: Element) =>
  host.querySelector<HTMLInputElement>('.gantt-detail-open input[aria-label="Task name"]')
    ?.value ?? null;

async function chartHolding(tasks: Task[], props: Partial<GanttProps> = {}) {
  const log: (string | null)[] = [];
  const ref = createRef<GanttHandle>();
  const onDetailChange: GanttProps['onDetailChange'] = (opened) =>
    void log.push(opened?.id ?? null);
  const element = (next: Partial<GanttProps>) =>
    createElement(Gantt, {
      ref,
      showDetail: true,
      tasks,
      onDetailChange,
      ...props,
      ...next,
    });
  const { host, rerender } = await render(element({}));
  await settle();
  return {
    log,
    get shown() {
      return shown(host);
    },
    rerender: async (next: Partial<GanttProps>) => {
      await rerender(element(next));
      await settle();
    },
    clickBar: async (id: string) => {
      await click(host.querySelector(`.gantt-task-bar[data-task-id="${id}"]`)!);
      await settle();
    },
    act: async (fn: (handle: GanttHandle) => void) => {
      await act(async () => fn(ref.current!));
      await settle();
    },
  };
}

const ids = [{ id: 'a' }, { id: 'b' }];

describe('resolveDetailState', () => {
  it('stays closed while the panel is off, whatever is open', () => {
    expect(
      resolveDetailState({ enabled: false, uncontrolled: 'a', tasks: ids }),
    ).toEqual({ openId: null, task: null });
  });

  it('resolves the uncontrolled id to its task', () => {
    expect(resolveDetailState({ enabled: true, uncontrolled: 'a', tasks: ids })).toEqual(
      { openId: 'a', task: { id: 'a' } },
    );
  });

  it('lets the controlled value win over the internal one', () => {
    expect(
      resolveDetailState({
        enabled: true,
        detailTaskId: 'b',
        uncontrolled: 'a',
        tasks: ids,
      }),
    ).toEqual({ openId: 'b', task: { id: 'b' } });
  });

  it('treats an explicit null as controlled-and-closed', () => {
    expect(
      resolveDetailState({
        enabled: true,
        detailTaskId: null,
        uncontrolled: 'a',
        tasks: ids,
      }),
    ).toEqual({ openId: null, task: null });
  });

  it('keeps an open id that no longer names a task, with no task to render', () => {
    expect(
      resolveDetailState({ enabled: true, uncontrolled: 'gone', tasks: ids }),
    ).toEqual({ openId: 'gone', task: null });
  });
});

describe('openDetail', () => {
  it('opens a task the host just added, called from the host effect that first sees it', async () => {
    const log: (string | null)[] = [];
    let addX = () => {};
    function Host() {
      const ref = useRef<GanttHandle>(null);
      const [tasks, setTasks] = useState([a]);
      addX = () => setTasks([a, x]);
      useEffect(() => {
        if (tasks.includes(x)) ref.current?.openDetail('x');
      }, [tasks]);
      return createElement(Gantt, {
        ref,
        tasks,
        showDetail: true,
        onDetailChange: (opened) => void log.push(opened?.id ?? null),
      });
    }
    const { host } = await render(createElement(Host));

    await act(async () => addX());
    await settle();

    expect({ shown: shown(host), log }).toEqual({ shown: 'X', log: ['x'] });
  });

  it('still ignores an id the chart does not hold, even once a task takes it', async () => {
    const chart = await chartHolding([a]);

    await chart.act((handle) => handle.openDetail('x'));
    await chart.rerender({ tasks: [a, x] });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: [] });
  });

  it('opens on a bar click', async () => {
    const chart = await chartHolding([a, b]);

    await chart.clickBar('b');

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: 'B', log: ['b'] });
  });

  it('only reports a click while detailTaskId is controlled, and opens nothing once control ends', async () => {
    const chart = await chartHolding([a, b], { detailTaskId: 'a' });

    await chart.clickBar('b');
    const whileControlled = chart.shown;
    await chart.rerender({ detailTaskId: undefined });

    expect({ whileControlled, after: chart.shown, log: chart.log }).toEqual({
      whileControlled: 'A',
      after: null,
      log: ['b'],
    });
  });
});

describe('a derived close', () => {
  it('stays closed when the removed task comes back', async () => {
    const chart = await chartHolding([a, b]);
    await chart.clickBar('b');
    await chart.rerender({ tasks: [a] });
    await chart.rerender({ tasks: [a, b] });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: ['b'] });
  });

  it('stays closed when the panel is turned off and on again', async () => {
    const chart = await chartHolding([a, b]);
    await chart.clickBar('b');
    await chart.rerender({ showDetail: false });
    await chart.rerender({ showDetail: true });

    expect({ shown: chart.shown, log: chart.log }).toEqual({ shown: null, log: ['b'] });
  });

  it('leaves closeDetail() silent, since the panel is already closed', async () => {
    const chart = await chartHolding([a, b]);
    await chart.clickBar('b');
    await chart.rerender({ tasks: [a] });
    await chart.act((handle) => handle.closeDetail());
    expect(chart.log).toEqual(['b']);

    const controlled = await chartHolding([a], { detailTaskId: 'b' });
    await controlled.act((handle) => handle.closeDetail());
    expect(controlled.log).toEqual([]);
  });
});
