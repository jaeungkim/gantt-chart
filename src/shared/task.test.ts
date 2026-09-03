import { describe, expect, it } from 'vitest';
import { normalizeProgress, resolveTaskInteraction, type Task } from './task';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'a',
  name: 'a',
  startDate: '2025-06-10T00:00:00Z',
  endDate: '2025-06-14T00:00:00Z',
  parentId: null,
  sequence: '1',
  ...overrides,
});

describe('normalizeProgress', () => {
  it('clamps to 0-100 and rejects missing or NaN values', () => {
    expect(normalizeProgress(42)).toBe(42);
    expect(normalizeProgress(-10)).toBe(0);
    expect(normalizeProgress(150)).toBe(100);
    expect(normalizeProgress(undefined)).toBeNull();
    expect(normalizeProgress(Number.NaN)).toBeNull();
  });
});

describe('resolveTaskInteraction - flag precedence (#37)', () => {
  it('allows everything when nothing is configured', () => {
    expect(resolveTaskInteraction(task())).toMatchObject({
      canMove: true,
      canResize: true,
      canChangeProgress: true,
    });
  });

  it('freezes the whole chart from the single readOnly prop', () => {
    expect(resolveTaskInteraction(task(), { readOnly: true })).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('lets a global capability flag gate one gesture on its own', () => {
    expect(
      resolveTaskInteraction(task(), { allowResize: false })
    ).toMatchObject({ canMove: true, canResize: false, canChangeProgress: true });
  });

  it('lets a per-task flag override the global one in both directions', () => {
    expect(
      resolveTaskInteraction(task({ allowMove: false }), { allowMove: true })
    ).toMatchObject({ canMove: false });
    expect(
      resolveTaskInteraction(task({ allowMove: true }), { allowMove: false })
    ).toMatchObject({ canMove: true });
  });

  it('lets a per-task readOnly freeze one task in an otherwise editable chart', () => {
    expect(resolveTaskInteraction(task({ readOnly: true }))).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('lets a per-task readOnly beat a permissive global capability flag', () => {
    expect(
      resolveTaskInteraction(task({ readOnly: true }), { allowMove: true })
    ).toMatchObject({ canMove: false });
  });

  it('lets a per-task capability flag punch through both blanket readOnly settings', () => {
    expect(
      resolveTaskInteraction(task({ readOnly: true, allowProgressChange: true }), {
        readOnly: true,
      })
    ).toMatchObject({
      canMove: false,
      canResize: false,
      canChangeProgress: true,
    });
  });

  it('never resizes a summary row or drags its rolled-up progress', () => {
    // Ends and percentage come from the children; moving is still allowed, it carries the subtree.
    expect(
      resolveTaskInteraction({
        ...task({ allowResize: true, allowProgressChange: true }),
        isSummary: true,
      })
    ).toMatchObject({
      canMove: true,
      canResize: false,
      canChangeProgress: false,
    });
  });

  it('still lets readOnly freeze a summary row entirely', () => {
    expect(
      resolveTaskInteraction({ ...task(), isSummary: true }, { readOnly: true })
    ).toMatchObject({ canMove: false, canResize: false });
  });

  it('takes bounds from the task first and the chart second', () => {
    expect(
      resolveTaskInteraction(task({ minDate: '2025-06-01' }), {
        minDate: '2025-01-01',
        maxDate: '2025-12-31',
      })
    ).toMatchObject({ minDate: '2025-06-01', maxDate: '2025-12-31' });
  });
});
