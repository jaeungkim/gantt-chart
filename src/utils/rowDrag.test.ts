import { NODE_HEIGHT, TREE_INDENT } from 'constants/gantt';
import type { Task } from 'types/task';
import { describe, expect, it } from 'vitest';
import { moveTaskInTree, resolveRowDropTarget } from './rowDrag';
import { sortTasksBySequence } from './transformData';
import { buildTaskTree, collectSubtreeIds, getVisibleTasks } from 'core/tree';

const task = (id: string, parentId: string | null, sequence: string): Task => ({
  id,
  name: id,
  startDate: '2025-01-02',
  endDate: '2025-01-03',
  parentId,
  sequence,
});

// root        1
//  ├ a        1.1
//  │  ├ a1    1.1.1
//  │  └ a2    1.1.2
//  └ b        1.2
// other       2
const nested = () => [
  task('root', null, '1'),
  task('a', 'root', '1.1'),
  task('a1', 'a', '1.1.1'),
  task('a2', 'a', '1.1.2'),
  task('b', 'root', '1.2'),
  task('other', null, '2'),
];

const ids = (tasks: Task[]) => tasks.map((t) => t.id);
const sequences = (tasks: Task[]) =>
  Object.fromEntries(tasks.map((t) => [t.id, t.sequence]));

/** Pointer Y at `fraction` down row `row` */
const atRow = (row: number, fraction: number) => (row + fraction) * NODE_HEIGHT;

/**
 * Resolve a drop the way the hook does: the tree comes from the full sequence-sorted list,
 * the rows are only what is on screen.
 */
const resolve = (
  tasks: Task[],
  draggedId: string,
  offsetY: number,
  deltaX = 0,
  collapsedIds: string[] = [],
) => {
  const sorted = sortTasksBySequence(tasks);
  const tree = buildTaskTree(sorted);
  const rows = getVisibleTasks(sorted, collapsedIds, tree).map((t) => ({
    id: t.id,
  }));

  return resolveRowDropTarget(rows, {
    draggedId,
    offsetY,
    deltaX,
    tree,
    blockedIds: new Set(collectSubtreeIds(sorted, draggedId, tree)),
  });
};

describe('resolveRowDropTarget', () => {
  it('inserts between siblings when the pointer is near a row edge', () => {
    // Top edge of 'a' -> the line sits above it, still under 'root'
    const target = resolve(nested(), 'b', atRow(1, 0.1));

    expect(target).toEqual({
      mode: 'line',
      rowIndex: 1,
      depth: 1,
      parentId: 'root',
      index: 0,
      valid: true,
    });
  });

  it('counts the siblings already above the gap', () => {
    // Bottom edge of 'a1' -> between 'a1' and 'a2', both children of 'a'
    const target = resolve(nested(), 'other', atRow(2, 0.9));

    expect(target).toMatchObject({
      mode: 'line',
      rowIndex: 3,
      parentId: 'a',
      index: 1,
      valid: true,
    });
  });

  it('re-parents when the pointer is in the middle of a row', () => {
    const target = resolve(nested(), 'other', atRow(1, 0.5));

    expect(target).toEqual({
      mode: 'into',
      rowIndex: 1,
      depth: 2,
      parentId: 'a',
      index: 2,
      valid: true,
    });
  });

  it('re-parents into a collapsed node, appending after its hidden children', () => {
    // 'a' is collapsed, so a1/a2 are not rows - the index still comes from the real tree
    const target = resolve(nested(), 'other', atRow(1, 0.5), 0, ['a']);

    expect(target).toMatchObject({ mode: 'into', parentId: 'a', index: 2 });
  });

  it('outdents to root on a leftward drag', () => {
    // Below 'b' (depth 1), one indent step left -> root level, after 'root'
    const target = resolve(nested(), 'b', atRow(4, 0.9), -TREE_INDENT);

    expect(target).toMatchObject({
      mode: 'line',
      rowIndex: 5,
      depth: 0,
      parentId: null,
      index: 1,
      valid: true,
    });
  });

  it('indents under the row above on a rightward drag', () => {
    // Below 'other' (a root) with one indent step right -> child of 'other'
    const target = resolve(nested(), 'b', atRow(5, 0.9), TREE_INDENT);

    expect(target).toMatchObject({
      mode: 'line',
      depth: 1,
      parentId: 'other',
      index: 0,
      valid: true,
    });
  });

  it('cannot indent deeper than one level under the row above', () => {
    const target = resolve(nested(), 'b', atRow(5, 0.9), TREE_INDENT * 10);

    expect(target).toMatchObject({ depth: 1, parentId: 'other' });
  });

  it('cannot outdent past the row below', () => {
    // Between 'a1' and 'a2': going shallower would swallow 'a2'
    const target = resolve(nested(), 'other', atRow(2, 0.9), -TREE_INDENT * 10);

    expect(target).toMatchObject({ depth: 2, parentId: 'a' });
  });

  it('marks a drop into its own descendant invalid', () => {
    const target = resolve(nested(), 'a', atRow(2, 0.5));

    expect(target).toMatchObject({
      mode: 'into',
      parentId: 'a1',
      valid: false,
    });
  });

  it('marks an insertion under its own subtree invalid', () => {
    // Between 'a1' and 'a2', indented to become a child of 'a' - which is the dragged row
    const target = resolve(nested(), 'a', atRow(2, 0.9), TREE_INDENT);

    expect(target).toMatchObject({ parentId: 'a', valid: false });
  });

  it('clamps a pointer above the first row and below the last', () => {
    expect(resolve(nested(), 'b', -500)).toMatchObject({
      mode: 'line',
      rowIndex: 0,
      depth: 0,
      parentId: null,
    });
    expect(resolve(nested(), 'b', 10000)).toMatchObject({
      mode: 'line',
      rowIndex: 6,
    });
  });

  it('returns nothing when the dragged row is not on screen', () => {
    expect(resolve(nested(), 'a1', atRow(1, 0.5), 0, ['a'])).toBeNull();
    expect(resolve(nested(), 'ghost', atRow(1, 0.5))).toBeNull();
  });
});

describe('moveTaskInTree', () => {
  it('reorders among siblings and renumbers the sequences', () => {
    const moved = moveTaskInTree(nested(), 'a2', 'a', 0);

    expect(ids(moved)).toEqual(['root', 'a', 'a2', 'a1', 'b', 'other']);
    expect(sequences(moved)).toEqual({
      root: '1',
      a: '1.1',
      a2: '1.1.1',
      a1: '1.1.2',
      b: '1.2',
      other: '2',
    });
  });

  it('re-parents into a collapsed node and appends to its children', () => {
    const moved = moveTaskInTree(nested(), 'other', 'a', 2);
    const byId = new Map(moved.map((t) => [t.id, t]));

    expect(byId.get('other')).toMatchObject({
      parentId: 'a',
      sequence: '1.1.3',
    });
    expect(byId.get('b')?.sequence).toBe('1.2');
  });

  it('outdents a nested row to the root level', () => {
    const moved = moveTaskInTree(nested(), 'a1', null, 1);
    const byId = new Map(moved.map((t) => [t.id, t]));

    expect(byId.get('a1')).toMatchObject({ parentId: null, sequence: '2' });
    expect(byId.get('a2')?.sequence).toBe('1.1.1');
    expect(byId.get('other')?.sequence).toBe('3');
  });

  it('moves the whole subtree with the row', () => {
    const moved = moveTaskInTree(nested(), 'a', null, 0);

    expect(ids(moved)).toEqual(['a', 'a1', 'a2', 'root', 'b', 'other']);
    expect(sequences(moved)).toMatchObject({
      a: '1',
      a1: '1.1',
      a2: '1.2',
      root: '2',
      b: '2.1',
    });
  });

  it('refuses to make a task its own descendant', () => {
    const tasks = nested();

    expect(moveTaskInTree(tasks, 'root', 'a1', 0)).toBe(tasks);
    expect(moveTaskInTree(tasks, 'a', 'a', 0)).toBe(tasks);
  });

  it('ignores an unknown task or parent', () => {
    const tasks = nested();

    expect(moveTaskInTree(tasks, 'ghost', null, 0)).toBe(tasks);
    expect(moveTaskInTree(tasks, 'a', 'ghost', 0)).toBe(tasks);
  });

  it('returns the same array when the drop changes nothing', () => {
    const tasks = nested();

    expect(moveTaskInTree(tasks, 'a1', 'a', 0)).toBe(tasks);
  });

  it('clamps an out-of-range index', () => {
    const moved = moveTaskInTree(nested(), 'other', 'a', 99);

    expect(moved.find((t) => t.id === 'other')?.sequence).toBe('1.1.3');
  });

  it('survives a round-trip through the sequence sort', () => {
    const moved = moveTaskInTree(nested(), 'other', 'a', 1);

    // The renumbered sequences reproduce exactly the order the move produced
    expect(ids(sortTasksBySequence(moved))).toEqual(ids(moved));
    expect(moveTaskInTree(moved, 'other', 'a', 1)).toBe(moved);
  });

  it('keeps an orphaned parentId while numbering the row as the root it renders as', () => {
    const tasks = [
      task('a', 'ghost', '5'),
      task('b', 'a', '5.1'),
      task('c', null, '9'),
    ];

    const moved = moveTaskInTree(tasks, 'c', null, 0);

    expect(ids(moved)).toEqual(['c', 'a', 'b']);
    expect(sequences(moved)).toEqual({ c: '1', a: '2', b: '2.1' });
    // The broken link is the host's data, not ours to rewrite
    expect(moved.find((t) => t.id === 'a')?.parentId).toBe('ghost');
  });

  it('does not hang on a parentId cycle', () => {
    const cyclic = [
      task('a', 'b', '1'),
      task('b', 'a', '2'),
      task('c', null, '3'),
    ];

    const moved = moveTaskInTree(cyclic, 'c', null, 0);

    // The cycle is broken into roots, so all three are renumbered at the root level
    expect(ids(moved)).toEqual(['c', 'a', 'b']);
    expect(sequences(moved)).toEqual({ c: '1', a: '2', b: '3' });
  });

  it('refuses a move into a cyclic chain that would still be a descendant', () => {
    const cyclic = [task('a', 'b', '1'), task('b', 'a', '2')];

    // Both are roots after normalization, so this is a plain reorder, not a nesting
    expect(ids(moveTaskInTree(cyclic, 'b', null, 0))).toEqual(['b', 'a']);
  });
});
