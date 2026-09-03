import type { Task } from '@jaeungkim/gantt-chart';

// Relative to today, not a fixed date: a pinned fixture drifts into the past and takes today off
// the rendered range with it. Last week's Monday, so weekends land predictably and today sits
// mid-fixture -- finished tasks behind it, in-progress straddling it, unstarted ahead.
const NOW = new Date();
const ANCHOR =
  Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) -
  (((NOW.getUTCDay() + 6) % 7) + 7) * 86_400_000;

// The fixture's first day, so a demo opens framed on its own data rather than on today.
export const DEMO_ANCHOR = new Date(ANCHOR).toISOString().slice(0, 10);

// Day `offset` from the anchor Monday, at `hours` o'clock UTC.
const at = (offset: number, hours: number) =>
  new Date(ANCHOR + offset * 86_400_000 + hours * 3_600_000)
    .toISOString()
    .slice(0, 19) + 'Z';

// One fixture for every demo on the site: presets vary the props, never the data.
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
  },
  {
    id: 't2',
    name: 'Content audit',
    startDate: at(1, 9),
    endDate: at(4, 17),
    parentId: 'p1',
    sequence: '1.2',
    progress: 70,
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
    dependencies: [{ targetId: 't6', type: 'FS' }],
  },
];

// Two midweek days inside the fixture's range, so their shading reads apart from the weekends.
export const demoHolidays: string[] = [at(7, 0).slice(0, 10), at(9, 0).slice(0, 10)];
