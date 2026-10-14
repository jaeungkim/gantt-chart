import { describe, expect, it } from 'vitest';
import { resolveDetailState } from './useGanttDetail';

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

  // Not `detailTaskId ?? uncontrolled`: an explicit null means controlled-and-closed
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

  // The id is kept so `commit` still sees it: reopening the same id must stay a no-op
  it('keeps an open id that no longer names a task, with no task to render', () => {
    expect(
      resolveDetailState({ enabled: true, uncontrolled: 'gone', tasks }),
    ).toEqual({ openId: 'gone', task: null });
  });
});
