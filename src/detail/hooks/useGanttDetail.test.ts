import { describe, expect, it } from 'vitest';
import { detailIdAfter, resolveDetailState } from './useGanttDetail';

const tasks = [{ id: 'a' }, { id: 'b' }];

describe('detailIdAfter', () => {
  it('opens on a click under the default trigger', () => {
    expect(detailIdAfter('click', 'selection', true, 'a')).toBe('a');
  });

  it('ignores a click when the trigger waits for a double click', () => {
    expect(detailIdAfter('click', 'doubleClick', true, 'a')).toBeUndefined();
  });

  it('opens on a double click only under that trigger', () => {
    expect(detailIdAfter('doubleClick', 'doubleClick', true, 'a')).toBe('a');
    expect(detailIdAfter('doubleClick', 'selection', true, 'a')).toBeUndefined();
  });

  it('leaves the panel alone under "none", whatever happened', () => {
    expect(detailIdAfter('click', 'none', true, 'a')).toBeUndefined();
    expect(detailIdAfter('doubleClick', 'none', true, 'a')).toBeUndefined();
  });

  it('does nothing at all while the panel is off', () => {
    expect(detailIdAfter('click', 'selection', false, 'a')).toBeUndefined();
    expect(detailIdAfter('doubleClick', 'doubleClick', false, 'a')).toBeUndefined();
  });
});

describe('resolveDetailState', () => {
  it('stays closed while the panel is off, whatever is open', () => {
    expect(
      resolveDetailState({ enabled: false, uncontrolled: 'a', tasks }),
    ).toEqual({ openId: null, task: null, stale: false });
  });

  it('resolves the uncontrolled id to its task', () => {
    expect(resolveDetailState({ enabled: true, uncontrolled: 'a', tasks })).toEqual(
      { openId: 'a', task: { id: 'a' }, stale: false },
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
    ).toEqual({ openId: 'b', task: { id: 'b' }, stale: false });
  });

  // Not `detailTaskId ?? uncontrolled`: an explicit null means controlled-and-closed
  it('treats an explicit null as controlled-and-closed', () => {
    expect(
      resolveDetailState({
        enabled: true,
        detailTaskId: null,
        uncontrolled: 'a',
        tasks,
      }),
    ).toEqual({ openId: null, task: null, stale: false });
  });

  it('reports an open id that no longer names a task as stale', () => {
    expect(
      resolveDetailState({ enabled: true, uncontrolled: 'gone', tasks }),
    ).toEqual({ openId: 'gone', task: null, stale: true });
  });

  it('is not stale merely because nothing is open', () => {
    expect(
      resolveDetailState({ enabled: true, uncontrolled: null, tasks }),
    ).toEqual({ openId: null, task: null, stale: false });
  });
});
