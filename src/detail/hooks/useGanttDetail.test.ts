import { describe, expect, it } from 'vitest';
import { resolveDetailState } from './useGanttDetail';

const tasks = [{ id: 'a' }, { id: 'b' }];

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
