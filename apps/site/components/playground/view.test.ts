import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = <T>(init: () => T): T => {
    const k = hooks.cursor++;
    if (!(k in hooks.slots)) hooks.slots[k] = init();
    return hooks.slots[k] as T;
  };
  return {
    ...actual,
    useRef: <T>(current: T) => slot(() => ({ current })),
    useState: <T>(initial: T | (() => T)) => {
      const cell = slot(() => {
        const state = {
          value: typeof initial === 'function' ? (initial as () => T)() : initial,
          set: (next: T | ((current: T) => T)) => {
            state.value =
              typeof next === 'function' ? (next as (current: T) => T)(state.value) : next;
          },
        };
        return state;
      });
      return [cell.value, cell.set];
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const cell = slot(() => ({}) as { deps?: unknown[]; cleanup?: void | (() => void) });
      if (cell.deps && deps.every((dep, k) => Object.is(dep, cell.deps?.[k]))) return;
      hooks.effects.push(() => {
        cell.cleanup?.();
        cell.deps = deps;
        cell.cleanup = effect();
      });
    },
  };
});

vi.mock('@jaeungkim/gantt-chart', () => ({ ReactGanttChart: () => null }));

import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import { demoTasks } from '@/components/demo/tasks';
import { PlaygroundView } from './view';

type Element = { type: unknown; key: string | null; props: Record<string, unknown> };

const fire = (element: Element, handler: string, ...args: unknown[]) =>
  (element.props[handler] as (...args: unknown[]) => void)(...args);

vi.stubGlobal('window', {
  location: { search: '', pathname: '/playground', hash: '' },
  history: { replaceState: () => {} },
});

type KeyListener = (event: { key: string }) => void;
const keydown = new Set<KeyListener>();
let panelOpen = false;

vi.stubGlobal('document', {
  body: { style: {} },
  addEventListener: (_type: string, listener: KeyListener) => keydown.add(listener),
  removeEventListener: (_type: string, listener: KeyListener) => keydown.delete(listener),
  querySelector: (selector: string) => (panelOpen && selector === '.gantt-detail-open' ? {} : null),
});

const press = (key: string) => keydown.forEach((listener) => listener({ key }));

function render(): Element {
  hooks.cursor = 0;
  hooks.effects = [];
  const tree = PlaygroundView() as unknown as Element;
  hooks.effects.forEach((run) => run());
  return tree;
}

function mount(search = ''): Element {
  hooks.slots = [];
  keydown.clear();
  panelOpen = false;
  window.location.search = search;
  return render();
}

function find(node: unknown, match: (element: Element) => boolean): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match);
      if (hit) return hit;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null || !('props' in node)) return undefined;
  const element = node as Element;
  return match(element) ? element : find(element.props.children, match);
}

const chart = (tree: Element) => find(tree, (element) => element.type === ReactGanttChart)!;

const byTestId = (tree: Element, id: string) =>
  find(tree, (element) => element.props['data-testid'] === id)!;

describe('chart props', () => {
  it('hands the chart only props GanttProps declares', () => {
    const source = readFileSync(new URL('../../../../src/props.ts', import.meta.url), 'utf8');
    const start = source.indexOf('export interface GanttProps {');
    const body = source.slice(start, source.indexOf('\n}', start));
    const declared = new Set([...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]));

    const passed = Object.keys(chart(mount()).props).filter((prop) => prop !== 'ref');
    expect(passed.filter((prop) => !declared.has(prop))).toEqual([]);
  });
});

describe('fullscreen', () => {
  const pressed = (tree: Element) => byTestId(tree, 'fullscreen-toggle').props['aria-pressed'];

  it('leaves an Escape to the open detail panel, and exits on the next one', () => {
    fire(byTestId(mount(), 'fullscreen-toggle'), 'onClick');
    expect(pressed(render())).toBe(true);

    panelOpen = true;
    press('Escape');
    expect(pressed(render())).toBe(true);

    panelOpen = false;
    press('Escape');
    expect(pressed(render())).toBe(false);
  });
});

describe('drag bounds', () => {
  it('cover every fixture task, so a clamp never pulls a bar inward', () => {
    const { minDate, maxDate } = chart(mount('?dateBounds=1')).props as Record<string, string>;
    const outside = demoTasks
      .filter(
        (task) =>
          Date.parse(task.startDate) < Date.parse(minDate) ||
          Date.parse(task.endDate) > Date.parse(maxDate)
      )
      .map((task) => task.id);
    expect(outside).toEqual([]);
  });
});

describe('console mirrors', () => {
  const stat = (tree: Element, term: string) =>
    (find(tree, (element) => element.key === term)!.props.children as Element[])[1].props.children;

  function openT5(): Element {
    const tree = mount();
    fire(chart(tree), 'onTaskSelect', { id: 't5' });
    fire(chart(tree), 'onDetailChange', { id: 't5' });
    return render();
  }

  it('Reset data remounts the chart, and the console restarts with it', () => {
    let tree = openT5();
    const before = chart(tree).key;

    fire(find(tree, (element) => element.props.children === 'Reset data')!, 'onClick');
    tree = render();
    expect(chart(tree).key).not.toBe(before);
    expect([stat(tree, 'Selected'), stat(tree, 'Detail')]).toEqual(['-', '-']);
  });

  it.each(['controlledDetail', 'initialScrollTo'])(
    'switching %s remounts the chart, and the console restarts with it',
    (key) => {
      let tree = openT5();
      expect([stat(tree, 'Selected'), stat(tree, 'Detail')]).toEqual(['t5', 't5']);
      const before = chart(tree).key;

      fire(byTestId(tree, key), 'onChange', { target: { checked: true, value: 'none' } });
      tree = render();
      expect(chart(tree).key).not.toBe(before);
      expect([stat(tree, 'Selected'), stat(tree, 'Detail')]).toEqual(['-', '-']);
    }
  );
});
