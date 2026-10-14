import { describe, expect, it } from 'vitest';
import type { Task, TaskDependency, TaskTransformed } from 'shared/task';
import {
  addDependency,
  linkTypeFromAnchors,
  removeDependency,
  resolveLinkTarget,
  validateDependency,
} from './link';

const task = (id: string, ...dependencies: TaskDependency[]): Task => ({
  id,
  name: id,
  startDate: '2025-01-01',
  endDate: '2025-01-02',
  parentId: null,
  sequence: id,
  dependencies,
});

// `b` depends on `a` (a is the predecessor)
const fs = (targetId: string): TaskDependency => ({ targetId, type: 'FS' });

describe('linkTypeFromAnchors', () => {
  it('maps every anchor pair to its dependency type', () => {
    expect(linkTypeFromAnchors('end', 'start')).toBe('FS');
    expect(linkTypeFromAnchors('start', 'start')).toBe('SS');
    expect(linkTypeFromAnchors('end', 'end')).toBe('FF');
    expect(linkTypeFromAnchors('start', 'end')).toBe('SF');
  });
});

const bar = (
  id: string,
  order: number,
  barLeft: number,
  barWidth: number
): TaskTransformed =>
  ({ ...task(id), order, barLeft, barWidth }) as unknown as TaskTransformed;

describe('resolveLinkTarget', () => {
  const ROW = 38;
  const ZONE = 24;
  // Rows 1 and 2, plus two tasks sharing row 3 as lanes
  const rows = [
    bar('a', 1, 100, 300),
    bar('b', 2, 500, 20),
    bar('c', 3, 0, 60),
    bar('d', 3, 400, 60),
  ];
  const at = (x: number, y: number) => resolveLinkTarget(rows, x, y, ROW, ZONE);

  it('takes the whole row band, not just the bar', () => {
    expect(at(5, ROW - 2)?.task.id).toBe('a');
    expect(at(2000, 4)?.task.id).toBe('a');
  });

  it('picks the nearest bar when lanes share a row', () => {
    expect(at(70, 2.5 * ROW)?.task.id).toBe('c');
    expect(at(390, 2.5 * ROW)?.task.id).toBe('d');
  });

  it('reads the middle of a bar, and everything left of it, as its start', () => {
    expect(at(10, 10)?.anchor).toBe('start');
    expect(at(250, 10)?.anchor).toBe('start');
  });

  it('reads the last of a bar, and everything right of it, as its finish', () => {
    expect(at(395, 10)?.anchor).toBe('end');
    expect(at(900, 10)?.anchor).toBe('end');
  });

  it('keeps a middle to aim at on a short bar', () => {
    // 20px wide, so the finish zone is a third of it rather than the whole bar
    expect(at(505, 1.5 * ROW)?.anchor).toBe('start');
    expect(at(518, 1.5 * ROW)?.anchor).toBe('end');
  });

  it('is nothing above the first row or below the last', () => {
    expect(at(200, -1)).toBeNull();
    expect(at(200, 10 * ROW)).toBeNull();
  });
});

describe('validateDependency', () => {
  it('accepts a link between two unrelated tasks', () => {
    const tasks = [task('a'), task('b')];
    expect(validateDependency(tasks, 'a', 'b')).toBeNull();
  });

  it('rejects a task linked to itself', () => {
    expect(validateDependency([task('a')], 'a', 'a')).toBe('self');
  });

  it('rejects a link that already exists', () => {
    const tasks = [task('a'), task('b', fs('a'))];
    expect(validateDependency(tasks, 'a', 'b')).toBe('duplicate');
  });

  it('rejects a direct cycle (the reverse link already exists)', () => {
    const tasks = [task('a'), task('b', fs('a'))];
    expect(validateDependency(tasks, 'b', 'a')).toBe('cycle');
  });

  it('rejects an indirect cycle through a chain', () => {
    // a <- b <- c, so making a depend on c closes the loop
    const tasks = [task('a'), task('b', fs('a')), task('c', fs('b'))];
    expect(validateDependency(tasks, 'c', 'a')).toBe('cycle');
  });

  it('rejects an indirect cycle through a branch of the predecessor graph', () => {
    // a has two predecessors; the loop is only on the second branch
    const tasks = [
      task('a'),
      task('b'),
      task('c', fs('a'), fs('b')),
      task('d', fs('c')),
    ];
    expect(validateDependency(tasks, 'd', 'b')).toBe('cycle');
  });

  it('allows a diamond - two paths to one predecessor are not a cycle', () => {
    const tasks = [task('a'), task('b', fs('a')), task('c', fs('a')), task('d')];
    expect(validateDependency(tasks, 'b', 'd')).toBeNull();
    expect(validateDependency(tasks, 'c', 'b')).toBeNull();
  });

  it('terminates on data that already contains a cycle', () => {
    const tasks = [task('a', fs('b')), task('b', fs('a')), task('c')];
    expect(validateDependency(tasks, 'a', 'c')).toBeNull();
  });

  it('ignores dependencies pointing at tasks that are not in the data', () => {
    const tasks = [task('a', fs('ghost')), task('b')];
    expect(validateDependency(tasks, 'a', 'b')).toBeNull();
  });
});

describe('addDependency', () => {
  it('appends the link to the successor and leaves the rest untouched', () => {
    const tasks = [task('a'), task('b')];
    const next = addDependency(tasks, 'a', 'b', 'SS');

    expect(next[1].dependencies).toEqual([{ targetId: 'a', type: 'SS' }]);
    expect(next[0]).toBe(tasks[0]);
    expect(tasks[1].dependencies).toEqual([]);
  });

  it('keeps the links the successor already had', () => {
    const tasks = [task('a'), task('b'), task('c', fs('a'))];
    expect(addDependency(tasks, 'b', 'c', 'FF')[2].dependencies).toEqual([
      { targetId: 'a', type: 'FS' },
      { targetId: 'b', type: 'FF' },
    ]);
  });

  it('returns the same array when the successor is unknown', () => {
    const tasks = [task('a')];
    expect(addDependency(tasks, 'a', 'ghost', 'FS')).toBe(tasks);
  });
});

describe('removeDependency', () => {
  it('drops only the matching link', () => {
    const tasks = [task('a'), task('b'), task('c', fs('a'), fs('b'))];
    expect(removeDependency(tasks, 'a', 'c')[2].dependencies).toEqual([
      { targetId: 'b', type: 'FS' },
    ]);
  });

  it('returns the same array when there is nothing to remove', () => {
    const tasks = [task('a'), task('b', fs('a'))];
    expect(removeDependency(tasks, 'b', 'a')).toBe(tasks);
    expect(removeDependency(tasks, 'a', 'ghost')).toBe(tasks);
  });
});
