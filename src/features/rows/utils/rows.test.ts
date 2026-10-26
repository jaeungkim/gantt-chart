import { describe, expect, it } from 'vitest';
import type { TaskTransformed } from 'shared/task';
import { buildGanttRows, packLanes } from './rows';

const task = (
  id: string,
  startDate: string,
  endDate: string,
  extra: Partial<TaskTransformed> = {},
): TaskTransformed => ({
  id,
  name: id,
  startDate,
  endDate,
  parentId: null,
  sequence: id,
  barLeft: 0,
  barWidth: 10,
  depth: 0,
  order: 1,
  originalOrder: 1,
  ...extra,
});

const idsOf = (tasks: TaskTransformed[][]) => tasks.map((row) => row.map((t) => t.id));

describe('packLanes', () => {
  it('puts non-overlapping tasks on one row', () => {
    const rows = packLanes([
      task('a', '2025-01-01', '2025-01-05'),
      task('b', '2025-01-10', '2025-01-15'),
    ]);

    expect(idsOf(rows)).toEqual([['a', 'b']]);
  });

  it('stacks overlapping tasks onto extra rows', () => {
    const rows = packLanes([
      task('a', '2025-01-01', '2025-01-10'),
      task('b', '2025-01-05', '2025-01-15'),
      task('c', '2025-01-08', '2025-01-09'),
    ]);

    expect(idsOf(rows)).toEqual([['a'], ['b'], ['c']]);
  });

  it('reuses a row as soon as it is free again', () => {
    const rows = packLanes([
      task('a', '2025-01-01', '2025-01-10'),
      task('b', '2025-01-05', '2025-01-08'),
      task('c', '2025-01-11', '2025-01-12'),
    ]);

    expect(idsOf(rows)).toEqual([
      ['a', 'c'],
      ['b'],
    ]);
  });

  it('lets a task start exactly where the previous one ended', () => {
    const rows = packLanes([
      task('a', '2025-01-01', '2025-01-05'),
      task('b', '2025-01-05', '2025-01-09'),
    ]);

    expect(idsOf(rows)).toEqual([['a', 'b']]);
  });

  it('packs by date, not by input order', () => {
    const rows = packLanes([
      task('late', '2025-02-01', '2025-02-05'),
      task('early', '2025-01-01', '2025-01-05'),
    ]);

    expect(idsOf(rows)).toEqual([['early', 'late']]);
  });

});

describe('buildGanttRows', () => {
  it('is one row per task, untouched, without lanes', () => {
    const tasks = [
      task('a', '2025-01-01', '2025-01-02', { order: 1 }),
      task('b', '2025-01-03', '2025-01-04', { order: 2 }),
    ];
    const rows = buildGanttRows(tasks);

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(rows[0].tasks[0]).toBe(tasks[0]);
  });

  it('returns nothing for no tasks', () => {
    expect(buildGanttRows([])).toEqual([]);
  });

  it('renumbers order to the row number so arrows follow the rows', () => {
    const rows = buildGanttRows([
      task('a', '2025-01-01', '2025-01-05', { lane: 'team', order: 9 }),
      task('b', '2025-01-06', '2025-01-09', { lane: 'team', order: 9 }),
      task('c', '2025-01-02', '2025-01-04', { lane: 'team', order: 9 }),
    ]);

    expect(rows[0].tasks.map((t) => t.order)).toEqual([1, 1]);
    expect(rows[1].tasks[0].order).toBe(2);
  });

  it('shares a row between lane-mates and stacks the overlap', () => {
    const rows = buildGanttRows([
      task('a', '2025-01-01', '2025-01-05', { lane: 'team' }),
      task('b', '2025-01-06', '2025-01-09', { lane: 'team' }),
      task('c', '2025-01-02', '2025-01-04', { lane: 'team' }),
      task('solo', '2025-01-01', '2025-01-02'),
    ]);

    expect(rows.map((row) => row.tasks.map((t) => t.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['solo'],
    ]);
    expect(rows[0].tasks.map((t) => t.order)).toEqual([1, 1]);
    expect(rows[2].tasks[0].order).toBe(3);
  });

  it('ids a lane row with its task ids joined', () => {
    const rows = buildGanttRows([
      task('a', '2025-01-01', '2025-01-05', { lane: 'team' }),
      task('b', '2025-01-06', '2025-01-09', { lane: 'team' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['a+b']);
  });
});
