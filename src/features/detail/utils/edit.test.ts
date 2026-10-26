import { describe, expect, it } from 'vitest';
import dayjs from 'core/dates';
import { Task } from 'shared/task';
import {
  resolveDetailEditability,
  resolveFieldPatch,
} from './edit';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'a',
  name: 'a',
  startDate: '2025-06-10T09:30:00.000Z',
  endDate: '2025-06-14T17:00:00.000Z',
  parentId: null,
  sequence: '1',
  ...overrides,
});

describe('resolveDetailEditability', () => {
  it('allows everything when nothing is configured', () => {
    expect(resolveDetailEditability(task())).toEqual({
      name: true,
      dates: true,
      progress: true,
    });
  });

  it('renders no inputs for a readOnly task', () => {
    expect(resolveDetailEditability(task({ readOnly: true }))).toEqual({
      name: false,
      dates: false,
      progress: false,
    });
  });

  it('turns only the dates to text under allowResize: false', () => {
    expect(resolveDetailEditability(task(), { allowResize: false })).toEqual({
      name: true,
      dates: false,
      progress: true,
    });
  });

  it('keeps the name read-only under config readOnly even when a task flag reopens a gesture', () => {
    expect(
      resolveDetailEditability(task({ allowResize: true }), { readOnly: true }),
    ).toEqual({ name: false, dates: true, progress: false });
  });

  it('never offers date or progress inputs on a summary row', () => {
    expect(resolveDetailEditability({ ...task(), isSummary: true })).toEqual({
      name: true,
      dates: false,
      progress: false,
    });
  });
});

describe('resolveFieldPatch', () => {
  it('commits a name and reverts a blank one', () => {
    expect(resolveFieldPatch(task(), 'name', 'renamed')).toEqual({
      name: 'renamed',
    });
    expect(resolveFieldPatch(task(), 'name', '   ')).toBeNull();
  });

  it('replaces the date part only, keeping the time-of-day', () => {
    const patch = resolveFieldPatch(task(), 'startDate', '2025-06-12');
    expect(patch).toEqual({ startDate: '2025-06-12T09:30:00.000Z' });
  });

  it('reverts an empty or unparsable date', () => {
    expect(resolveFieldPatch(task(), 'startDate', '')).toBeNull();
    expect(resolveFieldPatch(task(), 'endDate', 'not-a-date')).toBeNull();
  });

  it('reverts a start moved onto or past the end', () => {
    expect(resolveFieldPatch(task(), 'startDate', '2025-06-20')).toBeNull();
    expect(resolveFieldPatch(task(), 'endDate', '2025-06-01')).toBeNull();
  });

  it('clamps into the resolved bounds, task bounds first', () => {
    const patch = resolveFieldPatch(
      task({ minDate: '2025-06-08T00:00:00Z' }),
      'startDate',
      '2025-06-01',
      { minDate: '2025-06-05T00:00:00Z' },
    );
    expect(patch).toEqual({
      startDate: dayjs('2025-06-08T00:00:00Z').toISOString(),
    });
  });

  it('reverts when the clamp itself lands past the other end', () => {
    expect(
      resolveFieldPatch(task(), 'startDate', '2025-06-01', {
        minDate: '2025-06-14T18:00:00Z',
      }),
    ).toBeNull();
  });

  it('clamps progress into 0-100 and reverts what is not a number', () => {
    expect(resolveFieldPatch(task(), 'progress', '150')).toEqual({
      progress: 100,
    });
    expect(resolveFieldPatch(task(), 'progress', '-5')).toEqual({ progress: 0 });
    expect(resolveFieldPatch(task(), 'progress', 'abc')).toBeNull();
    expect(resolveFieldPatch(task(), 'progress', '')).toBeNull();
  });
});
