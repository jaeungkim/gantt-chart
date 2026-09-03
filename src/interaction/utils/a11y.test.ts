import { describe, expect, it } from 'vitest';
import type { Task, TaskTransformed } from 'shared/task';
import {
  deleteTask,
  formatMovedAnnouncement,
  formatTaskAriaLabel,
  GanttKeyboardRow,
  nudgeTaskDates,
  resolveKeyboardAction,
  rowAriaProps,
  stepTaskProgress,
  taskAtFocus,
} from './a11y';
import dayjs from 'core/dates';
import { buildGanttRows } from 'rows/utils/rows';
import { buildTaskTree, getVisibleTasks } from 'core/tree';

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
  barWidth: 32,
  depth: 0,
  order: 1,
  originalOrder: 1,
  ...extra,
});

const row = (extra: Partial<GanttKeyboardRow> = {}): GanttKeyboardRow => ({
  cells: 4,
  firstBarCell: 3,
  expandable: false,
  expanded: true,
  ...extra,
});

const shortDate = (date: { format: (pattern: string) => string }) =>
  date.format('MMM D');

describe('formatTaskAriaLabel', () => {
  it('reads out the name, the dates and the progress', () => {
    expect(
      formatTaskAriaLabel(
        { name: 'Design phase', startDate: '2025-03-03', endDate: '2025-03-14' },
        shortDate,
        40,
      ),
    ).toBe('Design phase, Mar 3 to Mar 14, 40% complete');
  });

  it('leaves the progress out when there is none', () => {
    expect(
      formatTaskAriaLabel(
        { name: 'Design phase', startDate: '2025-03-03', endDate: '2025-03-14' },
        shortDate,
      ),
    ).toBe('Design phase, Mar 3 to Mar 14');
  });

  it('says summary for a rolled-up row', () => {
    expect(
      formatTaskAriaLabel(
        {
          name: 'Phase 1',
          startDate: '2025-03-03',
          endDate: '2025-03-14',
          isSummary: true,
        },
        shortDate,
      ),
    ).toBe('Phase 1, summary, Mar 3 to Mar 14');
  });
});

describe('formatMovedAnnouncement', () => {
  it('reads out the new position and the parent it landed under', () => {
    expect(formatMovedAnnouncement('Wireframes', 2, 4, 'Design phase')).toBe(
      'Wireframes moved to 2 of 4 under Design phase',
    );
  });

  it('says top level when there is no parent', () => {
    expect(formatMovedAnnouncement('Wireframes', 2, 4, null)).toBe(
      'Wireframes moved to 2 of 4 at the top level',
    );
  });
});

describe('rowAriaProps', () => {
  it('carries the tree position and the bars the row owns', () => {
    const [ganttRow] = buildGanttRows([task('a', '2025-01-01', '2025-01-02')]);

    expect(
      rowAriaProps(ganttRow, 0, {
        headerOffset: 1,
        expandable: true,
        expanded: false,
        ownedIds: ['task-a'],
      }),
    ).toEqual({
      role: 'row',
      'aria-level': 1,
      'aria-posinset': 1,
      'aria-setsize': 1,
      'aria-rowindex': 2,
      'aria-expanded': false,
      'aria-owns': 'task-a',
    });
  });

  it('leaves aria-expanded off a row that cannot be expanded', () => {
    const [ganttRow] = buildGanttRows([task('a', '2025-01-01', '2025-01-02')]);
    const props = rowAriaProps(ganttRow, 0, {
      headerOffset: 0,
      expandable: false,
      expanded: true,
    });

    expect(props['aria-expanded']).toBeUndefined();
    expect(props['aria-owns']).toBeUndefined();
    expect(props['aria-rowindex']).toBe(1);
  });
});

describe('resolveKeyboardAction', () => {
  const rows = [row(), row(), row()];

  it('moves down and up a row, keeping the column', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowDown' }, { row: 0, col: 2 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 1, col: 2 } });

    expect(
      resolveKeyboardAction({ key: 'ArrowUp' }, { row: 1, col: 2 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 2 } });
  });

  it('stops at the first and last row instead of wrapping', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowUp' }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 0 } });

    expect(
      resolveKeyboardAction({ key: 'ArrowDown' }, { row: 2, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 2, col: 0 } });
  });

  it('moves between the task list cells and the bar', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowRight' }, { row: 0, col: 2 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 3 } });

    // col 3 is the bar, and there is nothing to its right
    expect(
      resolveKeyboardAction({ key: 'ArrowRight' }, { row: 0, col: 3 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 3 } });
  });

  it('expands and collapses from the first cell before moving', () => {
    const collapsed = [row({ expandable: true, expanded: false })];
    expect(
      resolveKeyboardAction({ key: 'ArrowRight' }, { row: 0, col: 0 }, collapsed),
    ).toEqual({ kind: 'toggle', row: 0, col: 0 });

    const expanded = [row({ expandable: true, expanded: true })];
    expect(
      resolveKeyboardAction({ key: 'ArrowLeft' }, { row: 0, col: 0 }, expanded),
    ).toEqual({ kind: 'toggle', row: 0, col: 0 });

    // Already collapsed - Left just moves (and there is nowhere left to go)
    expect(
      resolveKeyboardAction({ key: 'ArrowLeft' }, { row: 0, col: 0 }, collapsed),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 0 } });
  });

  it('jumps within the row with Home/End and across the chart with ctrl', () => {
    expect(
      resolveKeyboardAction({ key: 'Home' }, { row: 1, col: 3 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 1, col: 0 } });

    expect(
      resolveKeyboardAction({ key: 'End' }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 1, col: 3 } });

    expect(
      resolveKeyboardAction({ key: 'Home', ctrlKey: true }, { row: 2, col: 3 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 0 } });

    expect(
      resolveKeyboardAction({ key: 'End', metaKey: true }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 2, col: 3 } });
  });

  it('turns Enter into a toggle on an expandable row and an activate elsewhere', () => {
    expect(
      resolveKeyboardAction({ key: 'Enter' }, { row: 0, col: 3 }, [
        row({ expandable: true }),
      ]),
    ).toEqual({ kind: 'toggle', row: 0, col: 3 });

    expect(
      resolveKeyboardAction({ key: ' ' }, { row: 0, col: 3 }, rows),
    ).toEqual({ kind: 'activate', row: 0, col: 3 });
  });

  it('maps the modifiers onto move, end resize and start resize', () => {
    expect(
      resolveKeyboardAction(
        { key: 'ArrowRight', altKey: true },
        { row: 0, col: 3 },
        rows,
      ),
    ).toEqual({ kind: 'nudge', row: 0, col: 3, mode: 'bar', steps: 1 });

    expect(
      resolveKeyboardAction(
        { key: 'ArrowLeft', shiftKey: true },
        { row: 0, col: 3 },
        rows,
      ),
    ).toEqual({ kind: 'nudge', row: 0, col: 3, mode: 'right', steps: -1 });

    expect(
      resolveKeyboardAction(
        { key: 'ArrowRight', altKey: true, shiftKey: true },
        { row: 0, col: 3 },
        rows,
      ),
    ).toEqual({ kind: 'nudge', row: 0, col: 3, mode: 'left', steps: 1 });
  });

  it('handles delete and the progress steps', () => {
    expect(
      resolveKeyboardAction({ key: 'Delete' }, { row: 1, col: 3 }, rows),
    ).toEqual({ kind: 'delete', row: 1, col: 3 });

    expect(
      resolveKeyboardAction({ key: '+' }, { row: 1, col: 3 }, rows),
    ).toEqual({ kind: 'progress', row: 1, col: 3, delta: 5 });

    expect(
      resolveKeyboardAction({ key: '-' }, { row: 1, col: 3 }, rows),
    ).toEqual({ kind: 'progress', row: 1, col: 3, delta: -5 });
  });

  // The only pointer-free way to rescale, and the chart ships no scale UI of its own
  it('steps the scale on ctrl/meta + the vertical arrows', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowUp', ctrlKey: true }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'zoom', direction: -1 });
    expect(
      resolveKeyboardAction({ key: 'ArrowDown', metaKey: true }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'zoom', direction: 1 });
  });

  it('leaves the unmodified vertical arrows as row navigation', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowUp' }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 0, col: 0 } });
  });

  it('leaves keys it does not own alone', () => {
    expect(resolveKeyboardAction({ key: 'Tab' }, { row: 0, col: 0 }, rows)).toBeNull();
    expect(resolveKeyboardAction({ key: 'a' }, { row: 0, col: 0 }, rows)).toBeNull();
    // ...and a row that is not there
    expect(resolveKeyboardAction({ key: 'ArrowDown' }, { row: 9, col: 0 }, rows)).toBeNull();
  });
});

describe('resolveKeyboardAction - restructuring', () => {
  const rows = [row(), row(), row()];

  it('moves the row among its siblings on alt + the vertical arrows', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowDown', altKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'reorder', row: 1, col: 0, delta: 1 });

    expect(
      resolveKeyboardAction({ key: 'ArrowUp', altKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'reorder', row: 1, col: 0, delta: -1 });
  });

  it('indents on ctrl/meta + Right and outdents on ctrl/meta + Left', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowRight', ctrlKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'reparent', row: 1, col: 0, direction: 1 });

    expect(
      resolveKeyboardAction({ key: 'ArrowRight', metaKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'reparent', row: 1, col: 0, direction: 1 });

    expect(
      resolveKeyboardAction({ key: 'ArrowLeft', ctrlKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'reparent', row: 1, col: 0, direction: -1 });
  });

  // The new bindings sit between three that were already taken - none of them moved
  it('leaves the bindings it sits next to alone', () => {
    expect(
      resolveKeyboardAction({ key: 'ArrowRight', altKey: true }, { row: 0, col: 3 }, rows),
    ).toEqual({ kind: 'nudge', row: 0, col: 3, mode: 'bar', steps: 1 });

    expect(
      resolveKeyboardAction({ key: 'ArrowUp', ctrlKey: true }, { row: 1, col: 0 }, rows),
    ).toEqual({ kind: 'zoom', direction: -1 });

    expect(
      resolveKeyboardAction({ key: 'ArrowDown' }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 1, col: 0 } });
  });
});

describe('keyboard navigation across a collapsed subtree', () => {
  const tree = () => [
    task('parent', '2025-01-01', '2025-01-20', { isSummary: true }),
    task('child1', '2025-01-02', '2025-01-05', { parentId: 'parent', depth: 1 }),
    task('child2', '2025-01-06', '2025-01-09', { parentId: 'parent', depth: 1 }),
    task('sibling', '2025-01-21', '2025-01-25'),
  ];

  const rowsFor = (collapsed: string[]) => {
    const tasks = tree();
    const taskTree = buildTaskTree(tasks);
    const visible = getVisibleTasks(tasks, new Set(collapsed), taskTree);
    return buildGanttRows(visible);
  };

  const keyboardRows = (collapsed: string[]): GanttKeyboardRow[] =>
    rowsFor(collapsed).map((r) => ({
      cells: 3 + r.tasks.length,
      firstBarCell: 3,
      expandable: !!r.tasks[0]?.isSummary,
      expanded: !collapsed.includes(r.id),
    }));

  it('steps into the children while the parent is open', () => {
    const rows = keyboardRows([]);
    expect(rowsFor([]).map((r) => r.id)).toEqual([
      'parent',
      'child1',
      'child2',
      'sibling',
    ]);

    expect(
      resolveKeyboardAction({ key: 'ArrowDown' }, { row: 0, col: 0 }, rows),
    ).toEqual({ kind: 'focus', focus: { row: 1, col: 0 } });
  });

  it('skips straight to the sibling once the parent is collapsed', () => {
    const collapsed = ['parent'];
    const rows = rowsFor(collapsed);

    expect(rows.map((r) => r.id)).toEqual(['parent', 'sibling']);

    const action = resolveKeyboardAction(
      { key: 'ArrowDown' },
      { row: 0, col: 0 },
      keyboardRows(collapsed),
    );
    expect(action).toEqual({ kind: 'focus', focus: { row: 1, col: 0 } });

    // ...and that row really is the sibling, not a hidden child
    expect(rows[1].tasks[0].id).toBe('sibling');
  });

  it('reports aria-setsize over the visible siblings only', () => {
    const rows = rowsFor(['parent']);
    expect(rows.map((r) => r.setsize)).toEqual([2, 2]);
    expect(rowsFor([])[1].setsize).toBe(2);
  });
});

describe('taskAtFocus', () => {
  it('picks the lane the focus is on, and the first task from a list cell', () => {
    const [laneRow] = buildGanttRows([
      task('a', '2025-01-01', '2025-01-05', { lane: 'l' }),
      task('b', '2025-01-06', '2025-01-09', { lane: 'l' }),
    ]);

    expect(taskAtFocus(laneRow, 3, 3)?.id).toBe('a');
    expect(taskAtFocus(laneRow, 4, 3)?.id).toBe('b');
    expect(taskAtFocus(laneRow, 0, 3)?.id).toBe('a');
    expect(taskAtFocus(undefined, 0, 0)).toBeUndefined();
  });
});

describe('nudgeTaskDates', () => {
  // The month scale drags in whole days
  const raw = (): Task[] => [
    {
      id: 'a',
      name: 'a',
      startDate: '2025-03-03T00:00:00.000Z',
      endDate: '2025-03-14T00:00:00.000Z',
      parentId: null,
      sequence: '1',
    },
  ];
  const target = () =>
    task('a', '2025-03-03T00:00:00.000Z', '2025-03-14T00:00:00.000Z');

  it('moves both ends by exactly one drag step', () => {
    const updated = nudgeTaskDates(raw(), target(), 'bar', 1, 'month');

    expect(updated?.[0].startDate).toBe('2025-03-04T00:00:00.000Z');
    expect(updated?.[0].endDate).toBe('2025-03-15T00:00:00.000Z');
  });

  it('moves backwards too', () => {
    const updated = nudgeTaskDates(raw(), target(), 'bar', -1, 'month');
    expect(updated?.[0].startDate).toBe('2025-03-02T00:00:00.000Z');
  });

  it('uses the scale’s own step - a week scale moves 6 hours', () => {
    const updated = nudgeTaskDates(raw(), target(), 'bar', 1, 'week');
    expect(updated?.[0].startDate).toBe('2025-03-03T06:00:00.000Z');
  });

  it('resizes one edge only', () => {
    const right = nudgeTaskDates(raw(), target(), 'right', 1, 'month');
    expect(right?.[0].startDate).toBe('2025-03-03T00:00:00.000Z');
    expect(right?.[0].endDate).toBe('2025-03-15T00:00:00.000Z');

    const left = nudgeTaskDates(raw(), target(), 'left', 1, 'month');
    expect(left?.[0].startDate).toBe('2025-03-04T00:00:00.000Z');
    expect(left?.[0].endDate).toBe('2025-03-14T00:00:00.000Z');
  });

  it('refuses to fold a bar over itself', () => {
    const tasks: Task[] = [
      { ...raw()[0], endDate: '2025-03-04T00:00:00.000Z' },
    ];
    const oneStepWide = task(
      'a',
      '2025-03-03T00:00:00.000Z',
      '2025-03-04T00:00:00.000Z',
    );

    expect(nudgeTaskDates(tasks, oneStepWide, 'right', -1, 'month')).toBeNull();
    expect(nudgeTaskDates(tasks, oneStepWide, 'left', 1, 'month')).toBeNull();
  });

  it('refuses every edit on a read-only chart', () => {
    const config = { readOnly: true };

    expect(nudgeTaskDates(raw(), target(), 'bar', 1, 'month', config)).toBeNull();
    expect(nudgeTaskDates(raw(), target(), 'right', 1, 'month', config)).toBeNull();
    expect(nudgeTaskDates(raw(), target(), 'left', 1, 'month', config)).toBeNull();
  });

  it('honours a per-task flag over the chart-wide one', () => {
    const tasks: Task[] = [{ ...raw()[0], allowMove: true }];
    const movable = task(
      'a',
      '2025-03-03T00:00:00.000Z',
      '2025-03-14T00:00:00.000Z',
      { allowMove: true },
    );

    expect(
      nudgeTaskDates(tasks, movable, 'bar', 1, 'month', { readOnly: true }),
    ).not.toBeNull();
  });

  it('never resizes a summary row', () => {
    const summary = task(
      'a',
      '2025-03-03T00:00:00.000Z',
      '2025-03-14T00:00:00.000Z',
      { isSummary: true },
    );

    expect(nudgeTaskDates(raw(), summary, 'right', 1, 'month')).toBeNull();
    expect(nudgeTaskDates(raw(), summary, 'left', 1, 'month')).toBeNull();
    // Moving it is still fine
    expect(nudgeTaskDates(raw(), summary, 'bar', 1, 'month')).not.toBeNull();
  });

  it('carries the whole subtree when a summary row moves', () => {
    const tasks: Task[] = [
      {
        id: 'p',
        name: 'p',
        startDate: '2025-03-03T00:00:00.000Z',
        endDate: '2025-03-14T00:00:00.000Z',
        parentId: null,
        sequence: '1',
      },
      {
        id: 'c',
        name: 'c',
        startDate: '2025-03-05T00:00:00.000Z',
        endDate: '2025-03-06T00:00:00.000Z',
        parentId: 'p',
        sequence: '1.1',
      },
    ];
    const summary = task(
      'p',
      '2025-03-03T00:00:00.000Z',
      '2025-03-14T00:00:00.000Z',
      { isSummary: true },
    );

    const updated = nudgeTaskDates(tasks, summary, 'bar', 1, 'month');
    expect(updated?.map((t) => t.startDate)).toEqual([
      '2025-03-04T00:00:00.000Z',
      '2025-03-06T00:00:00.000Z',
    ]);
  });

  it('stops on a bound instead of stepping past it', () => {
    const bounded: Task[] = [{ ...raw()[0], maxDate: '2025-03-14T00:00:00.000Z' }];
    const boundedTask = task(
      'a',
      '2025-03-03T00:00:00.000Z',
      '2025-03-14T00:00:00.000Z',
      { maxDate: '2025-03-14T00:00:00.000Z' },
    );

    // The bar already ends on the bound, so it cannot move any later
    expect(nudgeTaskDates(bounded, boundedTask, 'bar', 1, 'month')).toBeNull();
    expect(
      nudgeTaskDates(bounded, boundedTask, 'bar', -1, 'month')?.[0].startDate,
    ).toBe('2025-03-02T00:00:00.000Z');
  });

  it('ignores a zero-step nudge', () => {
    expect(nudgeTaskDates(raw(), target(), 'bar', 0, 'month')).toBeNull();
  });

  it('leaves the dates it was given untouched', () => {
    const tasks = raw();
    nudgeTaskDates(tasks, target(), 'bar', 3, 'month');
    expect(tasks[0].startDate).toBe('2025-03-03T00:00:00.000Z');
  });

  it('lands on the same date a drag of the same step count would', () => {
    const updated = nudgeTaskDates(raw(), target(), 'bar', 1, 'month');
    expect(dayjs(updated?.[0].startDate).diff(dayjs(raw()[0].startDate), 'day')).toBe(1);
  });
});

describe('stepTaskProgress', () => {
  const raw = (progress?: number): Task[] => [
    {
      id: 'a',
      name: 'a',
      startDate: '2025-03-03',
      endDate: '2025-03-14',
      parentId: null,
      sequence: '1',
      progress,
    },
  ];

  it('steps up and clamps at 100', () => {
    const target = task('a', '2025-03-03', '2025-03-14', { progress: 98 });
    expect(stepTaskProgress(raw(98), target, 5)?.[0].progress).toBe(100);
  });

  it('steps down and clamps at 0', () => {
    const target = task('a', '2025-03-03', '2025-03-14', { progress: 2 });
    expect(stepTaskProgress(raw(2), target, -5)?.[0].progress).toBe(0);
  });

  it('does nothing without a progress value, or when it cannot change', () => {
    const noProgress = task('a', '2025-03-03', '2025-03-14');
    expect(stepTaskProgress(raw(), noProgress, 5)).toBeNull();

    const target = task('a', '2025-03-03', '2025-03-14', { progress: 40 });
    expect(stepTaskProgress(raw(40), target, 5, { readOnly: true })).toBeNull();

    const atMax = task('a', '2025-03-03', '2025-03-14', { progress: 100 });
    expect(stepTaskProgress(raw(100), atMax, 5)).toBeNull();
  });
});

describe('deleteTask', () => {
  const tasks = (): Task[] => [
    { id: 'p', name: 'p', startDate: '2025-03-03', endDate: '2025-03-14', parentId: null, sequence: '1' },
    { id: 'c', name: 'c', startDate: '2025-03-04', endDate: '2025-03-05', parentId: 'p', sequence: '1.1' },
    { id: 'x', name: 'x', startDate: '2025-03-06', endDate: '2025-03-07', parentId: null, sequence: '2' },
  ];

  it('takes the subtree with it', () => {
    const target = task('p', '2025-03-03', '2025-03-14');
    expect(deleteTask(tasks(), target)?.map((t) => t.id)).toEqual(['x']);
  });

  it('refuses on a read-only chart', () => {
    const target = task('p', '2025-03-03', '2025-03-14');
    expect(deleteTask(tasks(), target, { readOnly: true })).toBeNull();
  });

  it('refuses a task that is not in the data', () => {
    const target = task('ghost', '2025-03-03', '2025-03-14');
    expect(deleteTask(tasks(), target)).toBeNull();
  });
});
