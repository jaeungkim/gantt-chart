import type { Task } from '@jaeungkim/gantt-chart';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function setTime(date: Date, hours: number, minutes = 0, seconds = 0): Date {
  const result = new Date(date);
  result.setUTCHours(hours, minutes, seconds, 0);
  return result;
}

function formatISO(date: Date): string {
  return date.toISOString().split('.')[0] + 'Z';
}

const baseDate = setTime(new Date(), 0, 0, 0);

/** The most recent Monday (UTC), so weekends always land on the same day offsets */
const mondayBase = setTime(
  addDays(baseDate, -((baseDate.getUTCDay() + 6) % 7)),
  0,
  0,
  0
);

/** Day `offset` from the anchor Monday, at `hours` o'clock UTC */
const at = (offset: number, hours: number) =>
  formatISO(setTime(addDays(mondayBase, offset), hours));

/**
 * ===== Playground seed =====
 *
 * One dataset, because two drift apart. A website relaunch built to exercise every feature
 * the toolbar can turn on, anchored to the most recent Monday so weekends always fall on
 * the same day offsets.
 *
 * Leaf tasks run 09:00-17:00 and milestones sit at 17:00, so a link with no lag means "the
 * day after". Three summary rows (p1, p2, p3) give `hierarchy` something to collapse; they
 * carry no dependencies of their own, so they roll up from their children and leave the
 * scheduling chain below untouched.
 *
 * The chain s1 -> s2 -> s5 -> s7 -> s8 -> s10 -> s11 is laid out tight, which makes it the
 * critical path; the design branch (s3, s4, s6) and the parallel perf work (s9) are
 * deliberately loose and carry slack. Two tasks and the launch milestone carry baselines,
 * and post-launch support is pinned with `manuallyScheduled`.
 *
 * Expected with `criticalPath` on (calendar days):
 *   critical: s1 s2 s5 s7 s8 s10 s11 - total slack 0
 *   slack:    s3 4, s4 4, s6 1, s9 3
 */
export const seedTasks: Task[] = [
  {
    id: 'p1',
    name: 'Discovery',
    startDate: at(0, 9),
    endDate: at(4, 17),
    parentId: null,
    sequence: '1',
  },
  {
    id: 's1',
    name: 'Project kickoff',
    startDate: at(0, 9),
    endDate: at(0, 17),
    parentId: 'p1',
    sequence: '1.1',
    progress: 60,
    dependencies: [],
  },
  {
    id: 's2',
    name: 'Content audit',
    startDate: at(1, 9),
    endDate: at(4, 17),
    parentId: 'p1',
    sequence: '1.2',
    progress: 70,
    // Planned to wrap a day earlier - the baseline bar shows the slip
    baselineStart: at(1, 9),
    baselineEnd: at(3, 17),
    dependencies: [{ targetId: 's1', type: 'FS' }],
  },
  {
    id: 's3',
    name: 'Visual design',
    startDate: at(1, 9),
    endDate: at(3, 17),
    parentId: 'p1',
    sequence: '1.3',
    progress: 100,
    dependencies: [{ targetId: 's1', type: 'FS' }],
  },
  {
    id: 's4',
    name: 'Design sign-off',
    startDate: at(3, 17),
    endDate: at(3, 17),
    parentId: 'p1',
    sequence: '1.4',
    type: 'milestone',
    dependencies: [{ targetId: 's3', type: 'FS' }],
  },
  {
    id: 'p2',
    name: 'Build',
    startDate: at(5, 9),
    endDate: at(15, 17),
    parentId: null,
    sequence: '2',
  },
  {
    id: 's5',
    name: 'CMS migration',
    startDate: at(5, 9),
    endDate: at(11, 17),
    parentId: 'p2',
    sequence: '2.1',
    progress: 30,
    baselineStart: at(5, 9),
    baselineEnd: at(9, 17),
    dependencies: [{ targetId: 's2', type: 'FS' }],
  },
  {
    id: 's6',
    name: 'Template build',
    startDate: at(8, 9),
    endDate: at(10, 17),
    parentId: 'p2',
    sequence: '2.2',
    progress: 20,
    // A day of lag after sign-off, and started later than it had to - hence its slack
    dependencies: [{ targetId: 's4', type: 'FS', lag: 1 }],
  },
  {
    id: 's7',
    name: 'Content load',
    startDate: at(12, 9),
    endDate: at(15, 17),
    parentId: 'p2',
    sequence: '2.3',
    progress: 0,
    dependencies: [
      { targetId: 's5', type: 'FS' },
      { targetId: 's6', type: 'FS' },
    ],
  },
  {
    id: 'p3',
    name: 'Launch',
    startDate: at(16, 9),
    endDate: at(24, 17),
    parentId: null,
    sequence: '3',
  },
  {
    id: 's8',
    name: 'QA pass',
    startDate: at(16, 9),
    endDate: at(20, 17),
    parentId: 'p3',
    sequence: '3.1',
    progress: 0,
    dependencies: [{ targetId: 's7', type: 'FS' }],
  },
  {
    id: 's9',
    name: 'Performance tuning',
    startDate: at(16, 9),
    endDate: at(17, 17),
    parentId: 'p3',
    sequence: '3.2',
    progress: 0,
    // Starts alongside the content load rather than after it
    dependencies: [{ targetId: 's7', type: 'SS' }],
  },
  {
    id: 's10',
    name: 'Launch',
    startDate: at(20, 17),
    endDate: at(20, 17),
    parentId: 'p3',
    sequence: '3.3',
    type: 'milestone',
    baselineStart: at(19, 17),
    dependencies: [
      { targetId: 's8', type: 'FS' },
      { targetId: 's9', type: 'FS' },
    ],
  },
  {
    id: 's11',
    name: 'Post-launch support',
    startDate: at(21, 9),
    endDate: at(24, 17),
    parentId: 'p3',
    sequence: '3.4',
    progress: 0,
    // The engine never moves this one, whatever happens upstream
    manuallyScheduled: true,
    dependencies: [{ targetId: 's10', type: 'FS' }],
  },
];
