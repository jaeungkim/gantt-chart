import { describe, expect, it } from 'vitest';
import { CALENDAR_DAYS, type Task } from 'core';
import dayjs from 'core/dates';
import type { GanttScheduling } from 'types/gantt';
import { buildTaskChange } from 'utils/mutation';
import { applyDraggedDates, reschedule } from './useGanttBarDrag';

/**
 * The commit path a finished drag runs through, exercised on the very functions the
 * hook calls - no DOM, no pointer events.
 *
 * These three properties are what keep auto-scheduling honest under an async veto:
 * the payload has to describe the whole cascade, a veto has to undo the whole cascade,
 * and the committed cascade has to come from the predecessors as they are at commit
 * time rather than as they were at drop time.
 */

const task = (
  id: string,
  startDate: string,
  endDate: string,
  dependencies: Task['dependencies'] = []
): Task => ({
  id,
  name: id,
  startDate: `2025-${startDate}`,
  endDate: `2025-${endDate}`,
  parentId: null,
  sequence: id,
  dependencies,
});

const scheduling: GanttScheduling = {
  policy: 'shift-on-overlap',
  calendar: CALENDAR_DAYS,
  hierarchy: false,
};

// a -> b -> c, laid out tight, so any move of `a` carries the whole chain
const project: Task[] = [
  task('a', '06-02', '06-05'),
  task('b', '06-05', '06-08', [{ targetId: 'a', type: 'FS' }]),
  task('c', '06-08', '06-10', [{ targetId: 'b', type: 'FS' }]),
  task('loner', '06-02', '06-04'),
];

/** What a drag of `a` by `days` proposes for the tasks it moves directly */
const draggedDates = (tasks: Task[], id: string, days: number) => {
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no task ${id}`);
  return new Map([
    [
      id,
      {
        start: dayjs(found.startDate).add(days, 'day'),
        end: dayjs(found.endDate).add(days, 'day'),
      },
    ],
  ]);
};

const span = (tasks: Task[], id: string) => {
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no task ${id}`);
  return `${found.startDate.slice(5, 10)}..${found.endDate.slice(5, 10)}`;
};

describe('the veto payload', () => {
  it('describes every task the cascade moved, not just the dragged one', () => {
    const dragged = draggedDates(project, 'a', 3);
    const cascade = reschedule(project, dragged, scheduling);

    const change = buildTaskChange({
      type: 'move',
      taskId: 'a',
      changedIds: ['a', ...cascade.movedIds],
      previous: project,
      next: cascade.tasks,
    });

    expect(change.changedTasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(change.previousTasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    // previousTasks lines up index for index, so a host can diff without a lookup
    expect(change.previousTasks.map((t) => t.startDate)).toEqual(
      ['a', 'b', 'c'].map((id) => project.find((t) => t.id === id)?.startDate)
    );
    expect(change.changedTasks.map((t) => t.startDate.slice(5, 10))).toEqual([
      '06-05',
      '06-08',
      '06-11',
    ]);
    // an untouched task never appears in the payload
    expect(change.changedTasks.some((t) => t.id === 'loner')).toBe(false);
  });

  it('is just the dragged task when the policy is off', () => {
    const dragged = draggedDates(project, 'a', 3);
    const change = buildTaskChange({
      type: 'move',
      taskId: 'a',
      changedIds: ['a'],
      previous: project,
      next: applyDraggedDates(project, dragged),
    });

    expect(change.changedTasks.map((t) => t.id)).toEqual(['a']);
  });
});

describe('committing against the merged snapshot', () => {
  it('writes the gesture plus the cascade when nothing else changed', () => {
    const dragged = draggedDates(project, 'a', 3);
    const committed = reschedule(project, dragged, scheduling).tasks;

    expect(span(committed, 'a')).toBe('06-05..06-08');
    expect(span(committed, 'b')).toBe('06-08..06-11');
    expect(span(committed, 'c')).toBe('06-11..06-13');
  });

  it('reschedules from the predecessor as it is now, not as it was at drop', () => {
    // The user drops `a` three days later. While the veto is in flight, another edit
    // pushes `b` out four days on its own.
    const dragged = draggedDates(project, 'a', 3);
    const dropTimeCascade = reschedule(project, dragged, scheduling).tasks;
    const concurrent = project.map((t) =>
      t.id === 'b'
        ? { ...t, startDate: '2025-06-09', endDate: '2025-06-12' }
        : t
    );

    // Replaying the drop-time cascade would put b back at 06-08 and lose that edit;
    // recomputing from the merged tasks keeps it and pushes c past it instead
    const committed = reschedule(concurrent, dragged, scheduling).tasks;

    expect(span(dropTimeCascade, 'b')).toBe('06-08..06-11');
    expect(span(committed, 'b')).toBe('06-09..06-12');
    expect(span(committed, 'c')).toBe('06-12..06-14');
    // the gesture's own edit still lands exactly where the user dropped it
    expect(span(committed, 'a')).toBe('06-05..06-08');
  });

  it('leaves a concurrent edit alone when the cascade does not reach it', () => {
    const dragged = draggedDates(project, 'a', 3);
    const concurrent = project.map((t) =>
      t.id === 'loner'
        ? { ...t, startDate: '2025-07-01', endDate: '2025-07-03' }
        : t
    );

    const committed = reschedule(concurrent, dragged, scheduling).tasks;
    expect(span(committed, 'loner')).toBe('07-01..07-03');
  });

  it('applyDraggedDates alone is the policy-off commit', () => {
    const dragged = draggedDates(project, 'a', 3);
    const committed = applyDraggedDates(project, dragged);

    expect(span(committed, 'a')).toBe('06-05..06-08');
    expect(span(committed, 'b')).toBe('06-05..06-08'); // untouched
  });
});

describe('rolling a vetoed drag back', () => {
  it('covers the cascade, not just the bar the user grabbed', () => {
    // The hook clears the drag offsets of `[...ctx.taskIds, ...ctx.previewIds]`;
    // previewIds is exactly what the preview pass moved, and nothing was ever written
    // to rawTasks, so dropping those offsets restores every one of them.
    const dragged = draggedDates(project, 'a', 3);
    const previewIds = reschedule(project, dragged, scheduling).movedIds;
    const revertIds = ['a', ...previewIds];

    expect(revertIds).toEqual(['a', 'b', 'c']);
    // and the tasks themselves were never mutated by the preview
    expect(span(project, 'b')).toBe('06-05..06-08');
  });
});
