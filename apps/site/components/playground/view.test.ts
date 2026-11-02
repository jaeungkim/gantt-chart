// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { click, dispatch, keydown, render } from '../../../../src/shared/testing/dom';

const chartState = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  mounts: 0,
}));

vi.mock('@jaeungkim/gantt-chart', async () => {
  const { createElement: h, useState } = await import('react');
  return {
    ReactGanttChart: (props: Record<string, unknown>) => {
      const [mount] = useState(() => ++chartState.mounts);
      chartState.props = props;
      return h('div', { 'data-testid': 'chart', 'data-mount': mount });
    },
  };
});

import { demoTasks } from '@/components/demo/tasks';
import { PlaygroundView } from './view';

beforeEach(() => {
  window.history.replaceState(null, '', '/playground');
});

async function mount(search = '') {
  window.history.replaceState(null, '', `/playground${search}`);
  const { host } = await render(createElement(PlaygroundView));
  return host;
}

const byTestId = (host: Element, id: string) =>
  host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

const chartMount = (host: Element) => byTestId(host, 'chart').dataset.mount;

const fromChart = (callback: string, ...args: unknown[]) =>
  act(async () => {
    (chartState.props[callback] as (...args: unknown[]) => void)(...args);
  });

describe('chart props', () => {
  it('hands the chart only props GanttProps declares', async () => {
    const source = readFileSync(resolve(import.meta.dirname, '../../../../src/props.ts'), 'utf8');
    const start = source.indexOf('export interface GanttProps {');
    const body = source.slice(start, source.indexOf('\n}', start));
    const declared = new Set([...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]));

    await mount();
    const passed = Object.keys(chartState.props).filter((prop) => prop !== 'ref');
    expect(passed.length).toBeGreaterThan(0);
    expect(passed.filter((prop) => !declared.has(prop))).toEqual([]);
  });
});

describe('fullscreen', () => {
  const pressed = (host: Element) => byTestId(host, 'fullscreen-toggle').getAttribute('aria-pressed');

  it('leaves an Escape to the open detail panel, and exits on the next one', async () => {
    const host = await mount();
    await click(byTestId(host, 'fullscreen-toggle'));
    expect(pressed(host)).toBe('true');

    const panel = document.body.appendChild(document.createElement('div'));
    panel.className = 'gantt-detail-open';
    await keydown('Escape');
    expect(pressed(host)).toBe('true');

    panel.remove();
    await keydown('Escape');
    expect(pressed(host)).toBe('false');
  });
});

describe('drag bounds', () => {
  it('cover every fixture task, so a clamp never pulls a bar inward', async () => {
    await mount('?dateBounds=1');
    const { minDate, maxDate } = chartState.props as Record<string, string>;
    expect(minDate).toBeDefined();
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
  const stat = (host: Element, term: string) => {
    const row = [...byTestId(host, 'stats').querySelectorAll('dt')].find(
      (dt) => dt.textContent === term
    )!;
    return row.nextElementSibling!.textContent;
  };

  async function openT5() {
    const host = await mount();
    await fromChart('onTaskSelect', { id: 't5' });
    await fromChart('onDetailChange', { id: 't5' });
    expect([stat(host, 'Selected'), stat(host, 'Detail')]).toEqual(['t5', 't5']);
    return host;
  }

  it('Reset data remounts the chart, and the console restarts with it', async () => {
    const host = await openT5();
    const before = chartMount(host);

    const resetButton = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Reset data'
    )!;
    await click(resetButton);
    expect(chartMount(host)).not.toBe(before);
    expect([stat(host, 'Selected'), stat(host, 'Detail')]).toEqual(['-', '-']);
  });

  it('switching controlledDetail remounts the chart, and the console restarts with it', async () => {
    const host = await openT5();
    const before = chartMount(host);

    await click(byTestId(host, 'controlledDetail'));
    expect(chartMount(host)).not.toBe(before);
    expect([stat(host, 'Selected'), stat(host, 'Detail')]).toEqual(['-', '-']);
  });

  it('switching initialScrollTo remounts the chart, and the console restarts with it', async () => {
    const host = await openT5();
    const before = chartMount(host);

    const select = byTestId(host, 'initialScrollTo') as HTMLSelectElement;
    select.value = 'none';
    await dispatch(select, new Event('change', { bubbles: true }));
    expect(chartMount(host)).not.toBe(before);
    expect([stat(host, 'Selected'), stat(host, 'Detail')]).toEqual(['-', '-']);
  });
});
