import { describe, expect, it, vi } from 'vitest';
import { resolveTaskColors, type Task } from 'types/task';
import { buildTaskChange, createMutationGate, mutationKey } from './mutation';

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  name: id,
  startDate: '2025-01-02T00:00:00.000Z',
  endDate: '2025-01-03T00:00:00.000Z',
  parentId: null,
  sequence: id,
  ...over,
});

const shifted = (source: Task, days: number): Task => ({
  ...source,
  startDate: `2025-01-0${2 + days}T00:00:00.000Z`,
  endDate: `2025-01-0${3 + days}T00:00:00.000Z`,
});

// A gesture always claims its lane before it can settle - the helper keeps that pairing
const gestureOn = (
  gate: ReturnType<typeof createMutationGate>,
  key: string
) => {
  const token = gate.begin(key);
  return (handler: Parameters<typeof gate.settle>[2]) =>
    gate.settle(key, token, handler, change);
};

const previous = [task('a'), task('b'), task('c')];
const next = [shifted(previous[0], 1), previous[1], shifted(previous[2], 1)];
const change = buildTaskChange({
  type: 'move',
  taskId: 'a',
  changedIds: ['a', 'c'],
  previous,
  next,
});

describe('buildTaskChange', () => {
  it('carries only the tasks the gesture rewrites', () => {
    expect(change.type).toBe('move');
    expect(change.changedTasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(change.tasks).toBe(next);
    expect(change.edge).toBeUndefined();
  });

  it('lines previousTasks up with changedTasks index for index', () => {
    expect(change.previousTasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(change.previousTasks[0].startDate).toBe(previous[0].startDate);
    expect(change.changedTasks[0].startDate).not.toBe(previous[0].startDate);
  });

  it('reports the grabbed task in its post-change shape', () => {
    expect(change.task.id).toBe('a');
    expect(change.task).toBe(next[0]);
  });

  it('keeps the collected ids in render order, not in subtree-walk order', () => {
    const walkOrder = buildTaskChange({
      type: 'move',
      taskId: 'c',
      changedIds: ['c', 'a'],
      previous,
      next,
    });

    expect(walkOrder.changedTasks.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('records the edge of a resize', () => {
    const resize = buildTaskChange({
      type: 'resize',
      taskId: 'a',
      changedIds: ['a'],
      previous,
      next,
      edge: 'end',
    });

    expect(resize.edge).toBe('end');
    expect(resize.changedTasks).toHaveLength(1);
  });

  it('drops a changed id that has no previous entry rather than emitting a hole', () => {
    const added = buildTaskChange({
      type: 'move',
      taskId: 'a',
      changedIds: ['a', 'ghost'],
      previous,
      next: [...next, task('ghost')],
    });

    expect(added.changedTasks.map((t) => t.id)).toEqual(['a', 'ghost']);
    expect(added.previousTasks.map((t) => t.id)).toEqual(['a']);
  });
});

describe('mutationKey', () => {
  it('puts moves and resizes of one task in the same lane', () => {
    expect(mutationKey('move', 'a')).toBe(mutationKey('resize', 'a'));
  });

  it('keeps progress in its own lane, and tasks apart', () => {
    expect(mutationKey('progress', 'a')).not.toBe(mutationKey('move', 'a'));
    expect(mutationKey('move', 'a')).not.toBe(mutationKey('move', 'b'));
  });
});

describe('createMutationGate', () => {
  it('commits when the handler returns nothing', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(settle(() => undefined)).resolves.toBe('commit');
  });

  it('commits on an explicit true', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(settle(() => true)).resolves.toBe('commit');
  });

  it('rolls back on a synchronous false', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(settle(() => false)).resolves.toBe('rollback');
  });

  it('rolls back on a promise resolving to false', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(
      settle(async () => {
        await Promise.resolve();
        return false;
      })
    ).resolves.toBe('rollback');
  });

  it('rolls back on a rejected promise - the failed-server case', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(
      settle(() => Promise.reject(new Error('500 from the API')))
    ).resolves.toBe('rollback');
  });

  it('rolls back when the handler throws synchronously', async () => {
    const gate = createMutationGate();
    const settle = gestureOn(gate, 'dates:a');

    await expect(
      settle(() => {
        throw new Error('bad payload');
      })
    ).resolves.toBe('rollback');
  });

  it('hands the change to the handler untouched', async () => {
    const gate = createMutationGate();
    const handler = vi.fn(() => undefined);

    await gestureOn(gate, 'dates:a')(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(change);
  });

  it('drops a veto whose gesture was superseded while it was pending', async () => {
    const gate = createMutationGate();
    let release: (value: boolean) => void = () => {};
    const pending = new Promise<boolean>((resolve) => {
      release = resolve;
    });

    // First gesture: dropped, and its handler has not answered yet
    const first = gestureOn(gate, 'dates:a')(() => pending);

    // Second gesture on the same bar starts and finishes while that is still in flight
    const second = gestureOn(gate, 'dates:a')(() => undefined);
    await expect(second).resolves.toBe('commit');

    // The late veto no longer owns the bar, so its answer is dropped
    release(false);
    await expect(first).resolves.toBe('stale');
  });

  it('drops a superseded gesture even when its handler rejects', async () => {
    const gate = createMutationGate();
    let fail: (reason: Error) => void = () => {};
    const pending = new Promise<boolean>((_, reject) => {
      fail = reject;
    });

    const first = gestureOn(gate, 'dates:a')(() => pending);
    await gestureOn(gate, 'dates:a')(() => undefined);

    fail(new Error('timeout'));
    await expect(first).resolves.toBe('stale');
  });

  it('lets an unrelated lane settle normally while another one is pending', async () => {
    const gate = createMutationGate();
    const never = new Promise<boolean>(() => {});

    const pendingMove = gestureOn(gate, 'dates:a')(() => never);
    void pendingMove;

    // A different task, and this task's own progress lane, both answer for themselves
    await expect(gestureOn(gate, 'dates:b')(() => false)).resolves.toBe(
      'rollback'
    );
    await expect(gestureOn(gate, 'progress:a')(() => false)).resolves.toBe(
      'rollback'
    );
  });
});

describe('resolveTaskColors', () => {
  it('leaves the theme tokens in charge when there is no color', () => {
    expect(resolveTaskColors(undefined)).toEqual({});
    expect(resolveTaskColors('')).toEqual({});
    expect(resolveTaskColors('   ')).toEqual({});
  });

  it("takes the task's own color over the defaults", () => {
    const vars = resolveTaskColors('#3b82f6');

    expect(vars['--gantt-bar-color']).toBe('#3b82f6');
  });

  it('derives the fill and the hover shade from the bar color, not from a token', () => {
    const vars = resolveTaskColors('rebeccapurple');

    expect(vars['--gantt-progress-color']).toContain('rebeccapurple');
    expect(vars['--gantt-bar-color-hover']).toContain('rebeccapurple');
    // Darker than the bar, and darker again for the fill
    expect(vars['--gantt-bar-color-hover']).not.toBe(
      vars['--gantt-progress-color']
    );
  });

  it('passes any CSS color form through untouched', () => {
    expect(resolveTaskColors('  var(--brand)  ')['--gantt-bar-color']).toBe(
      'var(--brand)'
    );
    expect(
      resolveTaskColors('rgb(255 0 0 / 50%)')['--gantt-bar-color']
    ).toBe('rgb(255 0 0 / 50%)');
  });
});
