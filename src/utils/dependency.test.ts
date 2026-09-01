import { describe, expect, it } from 'vitest';
import type { Task, TaskDependency } from 'types/task';
import {
  addDependency,
  linkTypeFromAnchors,
  removeDependency,
  validateDependency,
} from './dependency';

const task = (id: string, ...dependencies: TaskDependency[]): Task => ({
  id,
  name: id,
  startDate: '2025-01-01',
  endDate: '2025-01-02',
  parentId: null,
  sequence: id,
  dependencies,
});

/** `b` depends on `a` (a is the predecessor) */
const fs = (targetId: string): TaskDependency => ({ targetId, type: 'FS' });

describe('linkTypeFromAnchors', () => {
  it('maps every anchor pair to its dependency type', () => {
    expect(linkTypeFromAnchors('end', 'start')).toBe('FS');
    expect(linkTypeFromAnchors('start', 'start')).toBe('SS');
    expect(linkTypeFromAnchors('end', 'end')).toBe('FF');
    expect(linkTypeFromAnchors('start', 'end')).toBe('SF');
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
    // b already depends on a, so making a depend on b closes a two-task loop
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
    //   a
    //  / \
    // b   c
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
