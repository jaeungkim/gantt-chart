import { describe, expect, it } from 'vitest';
import dayjs from './dates';
import type { Task } from './types';
import {
  buildTaskTree,
  collectSubtreeIds,
  getVisibleTasks,
  rollUpTasks,
} from './tree';

const task = (
  id: string,
  parentId: string | null,
  startDate = '2025-01-02',
  endDate = '2025-01-03',
  extra: Partial<Task> = {},
): Task => ({
  id,
  name: id,
  startDate,
  endDate,
  parentId,
  sequence: id,
  ...extra,
});

// root
//  ├ a
//  │  ├ a1
//  │  └ a2
//  └ b
const nested = () => [
  task('root', null),
  task('a', 'root'),
  task('a1', 'a'),
  task('a2', 'a'),
  task('b', 'root'),
];

describe('buildTaskTree', () => {
  it('derives depth and children for arbitrary nesting', () => {
    const tree = buildTaskTree(nested());

    expect([...tree.depthOf]).toEqual([
      ['root', 0],
      ['a', 1],
      ['a1', 2],
      ['a2', 2],
      ['b', 1],
    ]);
    expect(tree.childIds.get('root')).toEqual(['a', 'b']);
    expect(tree.childIds.get('a')).toEqual(['a1', 'a2']);
    expect(tree.childIds.has('a1')).toBe(false);
  });

  it('handles nesting far deeper than two levels', () => {
    const chain = Array.from({ length: 25 }, (_, i) =>
      task(`n${i}`, i === 0 ? null : `n${i - 1}`),
    );

    const tree = buildTaskTree(chain);

    expect(tree.depthOf.get('n24')).toBe(24);
    expect(collectSubtreeIds(chain, 'n0')).toHaveLength(25);
  });

  it('treats an orphaned parentId as a root', () => {
    const tree = buildTaskTree([task('a', 'ghost'), task('b', 'a')]);

    expect(tree.parentOf.get('a')).toBeNull();
    expect(tree.depthOf.get('a')).toBe(0);
    expect(tree.depthOf.get('b')).toBe(1);
  });

  it('breaks a self-referencing parentId', () => {
    const tree = buildTaskTree([task('a', 'a')]);

    expect(tree.parentOf.get('a')).toBeNull();
    expect(tree.childIds.size).toBe(0);
  });

  it('breaks a parentId cycle instead of hanging', () => {
    // a -> b -> c -> a: all three must drop to roots or the render walks forever
    const cyclic = [task('a', 'b'), task('b', 'c'), task('c', 'a')];

    const tree = buildTaskTree(cyclic);

    expect([...tree.depthOf.values()]).toEqual([0, 0, 0]);
    expect(tree.childIds.size).toBe(0);
  });

  it('roots a task hanging off a cycle', () => {
    const cyclic = [task('a', 'b'), task('b', 'a'), task('c', 'a')];

    const tree = buildTaskTree(cyclic);

    expect(tree.parentOf.get('c')).toBeNull();
    expect(tree.depthOf.get('c')).toBe(0);
  });
});

describe('collectSubtreeIds', () => {
  it('includes the root and every descendant', () => {
    expect(collectSubtreeIds(nested(), 'root')).toEqual([
      'root',
      'a',
      'b',
      'a1',
      'a2',
    ]);
    expect(collectSubtreeIds(nested(), 'a')).toEqual(['a', 'a1', 'a2']);
    expect(collectSubtreeIds(nested(), 'a1')).toEqual(['a1']);
  });

  it('returns nothing for an unknown id', () => {
    expect(collectSubtreeIds(nested(), 'nope')).toEqual([]);
  });

  it('terminates on a cyclic parentId chain', () => {
    const cyclic = [task('a', 'b'), task('b', 'a')];

    expect(collectSubtreeIds(cyclic, 'a')).toEqual(['a']);
  });
});

describe('getVisibleTasks', () => {
  it('hides the whole subtree of a collapsed parent', () => {
    const visible = getVisibleTasks(nested(), ['a']);

    expect(visible.map((t) => t.id)).toEqual(['root', 'a', 'b']);
  });

  it('hides descendants of a collapsed ancestor several levels up', () => {
    const visible = getVisibleTasks(nested(), ['root']);

    expect(visible.map((t) => t.id)).toEqual(['root']);
  });

  it('keeps a collapsed id inside an already hidden branch harmless', () => {
    const visible = getVisibleTasks(nested(), ['root', 'a']);

    expect(visible.map((t) => t.id)).toEqual(['root']);
  });

  it('returns the same array when nothing is collapsed', () => {
    const tasks = nested();

    expect(getVisibleTasks(tasks, [])).toBe(tasks);
  });

  it('ignores collapsed ids that are not in the data', () => {
    const visible = getVisibleTasks(nested(), ['ghost']);

    expect(visible).toHaveLength(5);
  });

  it('does not hang when the collapsed task sits on a cycle', () => {
    const cyclic = [task('a', 'b'), task('b', 'a'), task('c', null)];

    expect(getVisibleTasks(cyclic, ['a']).map((t) => t.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('rollUpTasks', () => {
  it('spans a parent from min child start to max child end', () => {
    const rolled = rollUpTasks([
      task('p', null, '2025-03-01', '2025-03-02'),
      task('c1', 'p', '2025-01-10', '2025-01-20'),
      task('c2', 'p', '2025-02-01', '2025-02-05'),
    ]);

    const parent = rolled[0];
    expect(parent.startDate).toBe(dayjs('2025-01-10').toISOString());
    expect(parent.endDate).toBe(dayjs('2025-02-05').toISOString());
  });

  it('rolls grandchildren up through every level', () => {
    const rolled = rollUpTasks([
      task('root', null, '2025-06-01', '2025-06-02'),
      task('mid', 'root', '2025-06-01', '2025-06-02'),
      task('leaf1', 'mid', '2025-01-01', '2025-01-05'),
      task('leaf2', 'mid', '2025-12-01', '2025-12-05'),
    ]);

    const byId = new Map(rolled.map((t) => [t.id, t]));
    expect(byId.get('mid')?.startDate).toBe(dayjs('2025-01-01').toISOString());
    expect(byId.get('root')?.startDate).toBe(dayjs('2025-01-01').toISOString());
    expect(byId.get('root')?.endDate).toBe(dayjs('2025-12-05').toISOString());
  });

  it('measures a milestone child at its startDate only', () => {
    const rolled = rollUpTasks([
      task('p', null),
      task('c', 'p', '2025-01-10', '2025-01-12'),
      task('m', 'p', '2025-02-01', '2030-01-01', { type: 'milestone' }),
    ]);

    expect(rolled[0].endDate).toBe(dayjs('2025-02-01').toISOString());
  });

  it('leaves leaves and childless parents untouched', () => {
    const tasks = [task('a', null), task('b', null)];

    expect(rollUpTasks(tasks)).toBe(tasks);
  });

  it('weights rolled-up progress by child duration', () => {
    // 10 days at 100% + 30 days at 0% -> 25%
    const rolled = rollUpTasks([
      task('p', null),
      task('c1', 'p', '2025-01-01', '2025-01-11', { progress: 100 }),
      task('c2', 'p', '2025-01-11', '2025-02-10', { progress: 0 }),
    ]);

    expect(rolled[0].progress).toBe(25);
  });

  it('keeps an explicit parent progress', () => {
    const rolled = rollUpTasks([
      task('p', null, '2025-01-01', '2025-01-02', { progress: 90 }),
      task('c', 'p', '2025-01-01', '2025-01-11', { progress: 10 }),
    ]);

    expect(rolled[0].progress).toBe(90);
  });

  it('leaves progress unset when no child reports one', () => {
    const rolled = rollUpTasks([task('p', null), task('c', 'p')]);

    expect(rolled[0].progress).toBeUndefined();
  });

  it('falls back to a plain average when every child has zero duration', () => {
    const rolled = rollUpTasks([
      task('p', null),
      task('c1', 'p', '2025-01-01', '2025-01-01', { progress: 100 }),
      task('c2', 'p', '2025-01-02', '2025-01-02', { progress: 0 }),
    ]);

    expect(rolled[0].progress).toBe(50);
  });

  it('does not roll up across a broken cycle', () => {
    const cyclic = [task('a', 'b', '2025-01-01', '2025-01-02'), task('b', 'a')];

    expect(rollUpTasks(cyclic)).toBe(cyclic);
  });
});
