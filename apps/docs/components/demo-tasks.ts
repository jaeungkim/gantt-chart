import type { Task } from '@jaeungkim/gantt-chart';

/**
 * Fixed anchor rather than `new Date()`: a docs demo that shifts with the calendar makes
 * screenshots and bug reports unreproducible. A Monday, so weekends land predictably.
 */
const ANCHOR = Date.UTC(2026, 0, 5);

/** The fixture's first day, so a demo opens framed on its own data rather than on today. */
export const DEMO_ANCHOR = new Date(ANCHOR).toISOString().slice(0, 10);

/** Day `offset` from the anchor Monday, at `hours` o'clock UTC. */
const at = (offset: number, hours: number) =>
  new Date(ANCHOR + offset * 86_400_000 + hours * 3_600_000)
    .toISOString()
    .slice(0, 19) + 'Z';

/**
 * One fixture for every demo on the site. Presets vary the props, not the data, so a
 * reader comparing two pages is looking at the same project twice.
 *
 * The chain t1 -> t2 -> t5 -> t6 -> t7 is tight and forms the critical path; the design
 * branch (t3, t4) carries slack. t2 and t5 carry baselines.
 */
export const demoTasks: Task[] = [
  {
    id: 'p1',
    name: 'Discovery',
    startDate: at(0, 9),
    endDate: at(4, 17),
    parentId: null,
    sequence: '1',
  },
  {
    id: 't1',
    name: 'Project kickoff',
    startDate: at(0, 9),
    endDate: at(0, 17),
    parentId: 'p1',
    sequence: '1.1',
    progress: 100,
    dependencies: [],
  },
  {
    id: 't2',
    name: 'Content audit',
    startDate: at(1, 9),
    endDate: at(4, 17),
    parentId: 'p1',
    sequence: '1.2',
    progress: 70,
    baselineStart: at(1, 9),
    baselineEnd: at(3, 17),
    dependencies: [{ targetId: 't1', type: 'FS' }],
  },
  {
    id: 't3',
    name: 'Visual design',
    startDate: at(1, 9),
    endDate: at(3, 17),
    parentId: 'p1',
    sequence: '1.3',
    progress: 100,
    dependencies: [{ targetId: 't1', type: 'FS' }],
  },
  {
    id: 't4',
    name: 'Design sign-off',
    startDate: at(3, 17),
    endDate: at(3, 17),
    parentId: 'p1',
    sequence: '1.4',
    type: 'milestone',
    dependencies: [{ targetId: 't3', type: 'FS' }],
  },
  {
    id: 'p2',
    name: 'Build',
    startDate: at(5, 9),
    endDate: at(14, 17),
    parentId: null,
    sequence: '2',
  },
  {
    id: 't5',
    name: 'CMS migration',
    startDate: at(5, 9),
    endDate: at(11, 17),
    parentId: 'p2',
    sequence: '2.1',
    progress: 30,
    baselineStart: at(5, 9),
    baselineEnd: at(9, 17),
    dependencies: [{ targetId: 't2', type: 'FS' }],
  },
  {
    id: 't6',
    name: 'Content load',
    startDate: at(12, 9),
    endDate: at(14, 17),
    parentId: 'p2',
    sequence: '2.2',
    progress: 0,
    dependencies: [{ targetId: 't5', type: 'FS' }],
  },
  {
    id: 't7',
    name: 'Launch',
    startDate: at(14, 17),
    endDate: at(14, 17),
    parentId: 'p2',
    sequence: '2.3',
    type: 'milestone',
    dependencies: [{ targetId: 't6', type: 'FS' }],
  },
];
