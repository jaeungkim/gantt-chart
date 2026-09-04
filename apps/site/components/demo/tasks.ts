import type { Holiday, Task } from '@jaeungkim/gantt-chart';

// Relative to today, not a fixed date: a pinned fixture drifts into the past and takes today off
// the rendered range with it. Three weeks back to this week's Monday, so weekends land predictably
// and today sits mid-fixture -- finished phases behind it, the build straddling it, launch ahead.
const NOW = new Date();
const ANCHOR =
  Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) -
  (((NOW.getUTCDay() + 6) % 7) + 21) * 86_400_000;

// The fixture's first day, so a demo opens framed on its own data rather than on today.
export const DEMO_ANCHOR = new Date(ANCHOR).toISOString().slice(0, 10);

// Day `offset` from the anchor Monday, at `hours` o'clock UTC. Offset 0 is a Monday, so 5/6, 12/13,
// 19/20, 26/27, 33/34, 40/41 and 47/48 are weekends and no task starts or ends on one.
const at = (offset: number, hours: number) =>
  new Date(ANCHOR + offset * 86_400_000 + hours * 3_600_000)
    .toISOString()
    .slice(0, 19) + 'Z';

// The same offset as a bare `YYYY-MM-DD`, which is what a holiday is written in.
const day = (offset: number) => at(offset, 0).slice(0, 10);

// One fixture for every demo on the site: presets vary the props, never the data. Seven weeks of a
// website redesign -- four phases, every dependency type, four milestones, and progress that agrees
// with where today falls (offset 24).
export const demoTasks: Task[] = [
  {
    id: 'p1',
    name: 'Discovery',
    startDate: at(0, 9),
    endDate: at(7, 17),
    parentId: null,
    sequence: '1',
  },
  {
    id: 't1',
    name: 'User interviews',
    startDate: at(0, 9),
    endDate: at(2, 17),
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
    progress: 100,
    // Starts alongside the interviews rather than after them.
    dependencies: [{ targetId: 't1', type: 'SS' }],
  },
  {
    id: 't3',
    name: 'Requirements brief',
    startDate: at(3, 9),
    endDate: at(7, 17),
    parentId: 'p1',
    sequence: '1.3',
    progress: 100,
    dependencies: [{ targetId: 't1', type: 'FS' }],
  },
  {
    id: 'm1',
    name: 'Scope locked',
    startDate: at(7, 17),
    endDate: at(7, 17),
    parentId: 'p1',
    sequence: '1.4',
    dependencies: [{ targetId: 't3', type: 'FS' }],
  },
  {
    id: 'p2',
    name: 'Design',
    startDate: at(8, 9),
    endDate: at(21, 17),
    parentId: null,
    sequence: '2',
  },
  {
    id: 't4',
    name: 'Wireframes',
    startDate: at(8, 9),
    endDate: at(11, 17),
    parentId: 'p2',
    sequence: '2.1',
    progress: 100,
    dependencies: [{ targetId: 'm1', type: 'FS' }],
  },
  {
    id: 't5',
    name: 'Visual language',
    startDate: at(8, 9),
    endDate: at(14, 17),
    parentId: 'p2',
    sequence: '2.2',
    progress: 100,
    dependencies: [{ targetId: 't4', type: 'SS' }],
  },
  {
    id: 't6',
    name: 'Design system',
    startDate: at(14, 9),
    endDate: at(18, 17),
    parentId: 'p2',
    sequence: '2.3',
    progress: 100,
    dependencies: [{ targetId: 't4', type: 'FS' }],
  },
  {
    id: 't7',
    name: 'Accessibility review',
    startDate: at(17, 9),
    endDate: at(18, 17),
    parentId: 'p2',
    sequence: '2.4',
    progress: 100,
    dependencies: [{ targetId: 't6', type: 'FS' }],
  },
  {
    id: 'm2',
    name: 'Design sign-off',
    startDate: at(21, 17),
    endDate: at(21, 17),
    parentId: 'p2',
    sequence: '2.5',
    dependencies: [{ targetId: 't6', type: 'FS' }],
  },
  {
    id: 'p3',
    name: 'Build',
    startDate: at(18, 9),
    endDate: at(39, 17),
    parentId: null,
    sequence: '3',
  },
  {
    id: 't8',
    name: 'Component library',
    startDate: at(18, 9),
    endDate: at(25, 17),
    parentId: 'p3',
    sequence: '3.1',
    progress: 90,
    dependencies: [{ targetId: 't6', type: 'FS' }],
  },
  {
    id: 't9',
    name: 'CMS migration',
    startDate: at(22, 9),
    endDate: at(32, 17),
    parentId: 'p3',
    sequence: '3.2',
    progress: 40,
    dependencies: [{ targetId: 'm2', type: 'FS' }],
  },
  {
    id: 't10',
    name: 'Page templates',
    startDate: at(28, 9),
    endDate: at(35, 17),
    parentId: 'p3',
    sequence: '3.3',
    progress: 0,
    dependencies: [{ targetId: 't8', type: 'FS' }],
  },
  {
    id: 't11',
    name: 'Content load',
    startDate: at(35, 9),
    endDate: at(39, 17),
    parentId: 'p3',
    sequence: '3.4',
    progress: 0,
    dependencies: [{ targetId: 't9', type: 'FS' }],
  },
  {
    id: 't12',
    name: 'Search and analytics',
    startDate: at(36, 9),
    endDate: at(39, 17),
    parentId: 'p3',
    sequence: '3.5',
    progress: 0,
    // Wired up by the time the content is in, not before it starts.
    dependencies: [{ targetId: 't11', type: 'FF' }],
  },
  {
    id: 'p4',
    name: 'Launch',
    startDate: at(42, 9),
    endDate: at(46, 17),
    parentId: null,
    sequence: '4',
  },
  {
    id: 't13',
    name: 'QA pass',
    startDate: at(42, 9),
    endDate: at(44, 17),
    parentId: 'p4',
    sequence: '4.1',
    progress: 0,
    dependencies: [{ targetId: 't12', type: 'FS' }],
  },
  {
    id: 't14',
    name: 'Stakeholder review',
    startDate: at(45, 9),
    endDate: at(45, 17),
    parentId: 'p4',
    sequence: '4.2',
    progress: 0,
    dependencies: [{ targetId: 't13', type: 'FS' }],
  },
  {
    id: 'm3',
    name: 'Go / no-go',
    startDate: at(45, 17),
    endDate: at(45, 17),
    parentId: 'p4',
    sequence: '4.3',
    dependencies: [{ targetId: 't14', type: 'FS' }],
  },
  {
    id: 'm4',
    name: 'Go live',
    startDate: at(46, 17),
    endDate: at(46, 17),
    parentId: 'p4',
    sequence: '4.4',
    dependencies: [{ targetId: 'm3', type: 'FS' }],
  },
  {
    id: 't15',
    name: 'Legacy site freeze',
    startDate: at(43, 9),
    endDate: at(46, 17),
    parentId: 'p4',
    sequence: '4.5',
    progress: 0,
    // Ends the moment the new site goes live -- the one place start-to-finish is the honest type.
    dependencies: [{ targetId: 'm4', type: 'SF' }],
  },
];

// Midweek days inside the fixture's range, so their shading reads apart from the weekends. One is
// named and tinted, one is a three-day block, one is a bare string -- all three shapes the prop
// takes, in the one place every demo reads its data from.
export const demoHolidays: (string | Holiday)[] = [
  { date: day(16), label: 'Company offsite', color: '#7c3aed' },
  { date: day(30), endDate: day(32), label: 'Summer shutdown', color: '#0ea5e9' },
  day(37),
];
