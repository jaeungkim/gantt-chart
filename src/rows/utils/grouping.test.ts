import { describe, expect, it } from 'vitest';
import type { TaskTransformed } from 'shared/task';
import { buildGanttRows, groupRowId, packLanes } from './grouping';
import { buildTaskTree } from 'core/tree';

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
  it('is one row per task, untouched, without groupBy or lanes', () => {
    const tasks = [
      task('a', '2025-01-01', '2025-01-02', { order: 1 }),
      task('b', '2025-01-03', '2025-01-04', { order: 2 }),
    ];
    const rows = buildGanttRows(tasks);

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    // The very objects handed in - no re-wrapping when the row numbers already match
    expect(rows[0].tasks[0]).toBe(tasks[0]);
    expect(rows.map((row) => row.level)).toEqual([1, 1]);
    expect(rows.map((row) => row.setsize)).toEqual([2, 2]);
    expect(rows.map((row) => row.posinset)).toEqual([1, 2]);
  });

  it('returns nothing for no tasks, grouped or not', () => {
    expect(buildGanttRows([])).toEqual([]);
    expect(buildGanttRows([], { groupBy: 'status' })).toEqual([]);
  });

  it('groups by a field name and puts a header in front of each group', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-02'),
        task('b', '2025-01-03', '2025-01-04'),
        task('c', '2025-01-05', '2025-01-06'),
      ],
      { groupBy: (t) => (t.id === 'b' ? 'QA' : 'Dev') },
    );

    expect(rows.map((row) => row.id)).toEqual([
      groupRowId('Dev'),
      'a',
      'c',
      groupRowId('QA'),
      'b',
    ]);
    expect(rows[0].group).toEqual({ key: 'Dev', label: 'Dev', count: 2 });
    // Group headers are the top level; their tasks sit one level below
    expect(rows.map((row) => row.level)).toEqual([1, 2, 2, 1, 2]);
    expect(rows[1].posinset).toBe(1);
    expect(rows[2].posinset).toBe(2);
    expect(rows[2].setsize).toBe(2);
  });

  it('groups by a field on the task', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-02', { name: 'Alice' }),
        task('b', '2025-01-03', '2025-01-04', { name: 'Bob' }),
      ],
      { groupBy: 'name' },
    );

    expect(rows.map((row) => row.group?.label ?? row.id)).toEqual([
      'Alice',
      'a',
      'Bob',
      'b',
    ]);
  });

  it('collects tasks with no group value under one Ungrouped header', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-02'),
        task('b', '2025-01-03', '2025-01-04'),
      ],
      { groupBy: (t) => (t.id === 'a' ? 'Dev' : null) },
    );

    expect(rows.map((row) => row.group?.label ?? row.id)).toEqual([
      'Dev',
      'a',
      'Ungrouped',
      'b',
    ]);
  });

  it('never emits a group with no tasks in it', () => {
    const rows = buildGanttRows([task('a', '2025-01-01', '2025-01-02')], {
      groupBy: () => 'Only',
    });

    expect(rows.filter((row) => row.group)).toHaveLength(1);
    expect(rows[0].group?.count).toBe(1);
  });

  it('keeps a collapsed group header and drops its rows', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-02'),
        task('b', '2025-01-03', '2025-01-04'),
      ],
      {
        groupBy: (t) => (t.id === 'a' ? 'Dev' : 'QA'),
        collapsedIds: new Set([groupRowId('Dev')]),
      },
    );

    expect(rows.map((row) => row.id)).toEqual([
      groupRowId('Dev'),
      groupRowId('QA'),
      'b',
    ]);
  });

  it('renumbers order to the row number so arrows follow the grouping', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-02', { order: 1 }),
        task('b', '2025-01-03', '2025-01-04', { order: 2 }),
      ],
      { groupBy: (t) => (t.id === 'a' ? 'Dev' : 'QA') },
    );

    // rows: [Dev header, a, QA header, b] -> a is row 2, b is row 4
    expect(rows[1].tasks[0].order).toBe(2);
    expect(rows[3].tasks[0].order).toBe(4);
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
    // Every task on a shared row reports that row's number
    expect(rows[0].tasks.map((t) => t.order)).toEqual([1, 1]);
    expect(rows[2].tasks[0].order).toBe(3);
  });

  it('keeps lanes inside their own group', () => {
    const rows = buildGanttRows(
      [
        task('a', '2025-01-01', '2025-01-05', { lane: 'shared' }),
        task('b', '2025-01-06', '2025-01-09', { lane: 'shared' }),
      ],
      { groupBy: (t) => (t.id === 'a' ? 'Dev' : 'QA') },
    );

    expect(rows.map((row) => row.tasks.map((t) => t.id))).toEqual([
      [],
      ['a'],
      [],
      ['b'],
    ]);
  });
});

describe('buildGanttRows with hierarchy', () => {
  // parent -> child, where the child's own field says something else
  const hierarchical = (): TaskTransformed[] => [
    task('parent', '2025-01-01', '2025-01-20', {
      depth: 0,
      isSummary: true,
      name: 'Dev',
    }),
    task('child', '2025-01-02', '2025-01-05', {
      parentId: 'parent',
      depth: 1,
      name: 'QA',
    }),
    task('other', '2025-01-10', '2025-01-12', { name: 'QA' }),
  ];

  it('takes a task’s group from its root ancestor, so a subtree is never split', () => {
    const tasks = hierarchical();
    const rows = buildGanttRows(tasks, {
      groupBy: 'name',
      tree: buildTaskTree(tasks),
    });

    expect(rows.map((row) => row.group?.label ?? row.id)).toEqual([
      'Dev',
      'parent',
      'child',
      'QA',
      'other',
    ]);
  });

  it('indents the hierarchy one level below the group header', () => {
    const tasks = hierarchical();
    const rows = buildGanttRows(tasks, {
      groupBy: 'name',
      tree: buildTaskTree(tasks),
    });

    expect(rows.map((row) => row.level)).toEqual([1, 2, 3, 1, 2]);
    // The child is the only row under its parent
    expect(rows[2]).toMatchObject({ posinset: 1, setsize: 1 });
    // ...and the parent the only row under the Dev header
    expect(rows[1]).toMatchObject({ posinset: 1, setsize: 1 });
  });

  it('numbers depth-derived siblings without a tree as well', () => {
    const rows = buildGanttRows([
      task('a', '2025-01-01', '2025-01-02', { depth: 0 }),
      task('a1', '2025-01-01', '2025-01-02', { depth: 1 }),
      task('a2', '2025-01-01', '2025-01-02', { depth: 1 }),
      task('b', '2025-01-01', '2025-01-02', { depth: 0 }),
    ]);

    expect(rows.map((row) => row.posinset)).toEqual([1, 1, 2, 2]);
    expect(rows.map((row) => row.setsize)).toEqual([2, 2, 2, 2]);
  });
});
