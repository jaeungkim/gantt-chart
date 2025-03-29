import { Task } from './src/types/task';

// Helper functions
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

const today = new Date();
const baseDate = setTime(new Date(today), 0, 0, 0);

export const sourceTasks: Task[] = [
  {
    id: '1',
    name: 'Project Kickoff',
    startDate: formatISO(setTime(addDays(baseDate, 0), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 0), 11)),
    parentId: null,
    sequence: '1',
    dependencies: [],
  },
  {
    id: '2',
    name: 'Requirement Gathering',
    startDate: formatISO(setTime(addDays(baseDate, 1), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 3), 17)),
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: '1', type: 'FS' }],
  },
  {
    id: '3',
    name: 'Stakeholder Interviews',
    startDate: formatISO(setTime(addDays(baseDate, 2), 10)),
    endDate: formatISO(setTime(addDays(baseDate, 2), 17)),
    parentId: '2',
    sequence: '2.1',
    dependencies: [{ targetId: '2', type: 'SS' }],
  },
  {
    id: '4',
    name: 'Market Analysis',
    startDate: formatISO(setTime(addDays(baseDate, 4), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 4), 17)),
    parentId: null,
    sequence: '3',
    dependencies: [{ targetId: '2', type: 'FS' }],
  },
  {
    id: '5',
    name: 'Design System Creation',
    startDate: formatISO(setTime(addDays(baseDate, 5), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 9), 17)),
    parentId: null,
    sequence: '4',
    dependencies: [{ targetId: '3', type: 'FF' }],
  },
  {
    id: '6',
    name: 'UI/UX Design',
    startDate: formatISO(setTime(addDays(baseDate, 10), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 13), 17)),
    parentId: '5',
    sequence: '4.1',
    dependencies: [{ targetId: '5', type: 'FS' }],
  },
  {
    id: '7',
    name: 'Prototyping',
    startDate: formatISO(setTime(addDays(baseDate, 14), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 17), 17)),
    parentId: '6',
    sequence: '4.1.1',
    dependencies: [{ targetId: '6', type: 'FF' }],
  },
  {
    id: '8',
    name: 'Frontend Development',
    startDate: formatISO(setTime(addDays(baseDate, 18), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 27), 17)),
    parentId: null,
    sequence: '5',
    dependencies: [{ targetId: '7', type: 'FS' }],
  },
  {
    id: '9',
    name: 'Backend Development',
    startDate: formatISO(setTime(addDays(baseDate, 5), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 14), 17)),
    parentId: null,
    sequence: '6',
    dependencies: [{ targetId: '4', type: 'FS' }],
  },
  {
    id: '10',
    name: 'API Integration',
    startDate: formatISO(setTime(addDays(baseDate, 15), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 17), 17)),
    parentId: '9',
    sequence: '6.1',
    dependencies: [{ targetId: '9', type: 'FF' }],
  },
  {
    id: '11',
    name: 'Module Development',
    startDate: formatISO(setTime(addDays(baseDate, 20), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 24), 17)),
    parentId: '8',
    sequence: '5.1',
    dependencies: [{ targetId: '8', type: 'SS' }],
  },
  {
    id: '12',
    name: 'Unit Testing',
    startDate: formatISO(setTime(addDays(baseDate, 25), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 27), 17)),
    parentId: '8',
    sequence: '5.2',
    dependencies: [{ targetId: '11', type: 'FF' }],
  },
  {
    id: '13',
    name: 'Integration Testing',
    startDate: formatISO(setTime(addDays(baseDate, 18), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 21), 17)),
    parentId: '10',
    sequence: '6.1.1',
    dependencies: [{ targetId: '10', type: 'FF' }],
  },
  {
    id: '14',
    name: 'Code Review',
    startDate: formatISO(setTime(addDays(baseDate, 22), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 24), 17)),
    parentId: '10',
    sequence: '6.1.2',
    dependencies: [{ targetId: '13', type: 'FF' }],
  },
  {
    id: '15',
    name: 'Community Feedback',
    startDate: formatISO(setTime(addDays(baseDate, 25), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 27), 17)),
    parentId: null,
    sequence: '7',
    dependencies: [{ targetId: '14', type: 'FS' }],
  },
  {
    id: '16',
    name: 'Documentation Drafting',
    startDate: formatISO(setTime(addDays(baseDate, 10), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 14), 17)),
    parentId: null,
    sequence: '8',
    dependencies: [{ targetId: '6', type: 'SS' }],
  },
  {
    id: '17',
    name: 'Documentation Finalization',
    startDate: formatISO(setTime(addDays(baseDate, 15), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 17), 17)),
    parentId: '16',
    sequence: '8.1',
    dependencies: [{ targetId: '16', type: 'FF' }],
  },
  {
    id: '18',
    name: 'Pre-release Demo',
    startDate: formatISO(setTime(addDays(baseDate, 28), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 30), 17)),
    parentId: null,
    sequence: '9',
    dependencies: [{ targetId: '15', type: 'FF' }],
  },
  {
    id: '19',
    name: 'Bug Fixing',
    startDate: formatISO(setTime(addDays(baseDate, 31), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 33), 17)),
    parentId: null,
    sequence: '10',
    dependencies: [{ targetId: '18', type: 'FS' }],
  },
  {
    id: '20',
    name: 'Release Candidate',
    startDate: formatISO(setTime(addDays(baseDate, 34), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 37), 17)),
    parentId: null,
    sequence: '11',
    dependencies: [{ targetId: '19', type: 'FF' }],
  },
  {
    id: '21',
    name: 'Final Release',
    startDate: formatISO(setTime(addDays(baseDate, 38), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 40), 17)),
    parentId: null,
    sequence: '12',
    dependencies: [{ targetId: '20', type: 'FS' }],
  },
  {
    id: '22',
    name: 'Post-release Monitoring',
    startDate: formatISO(setTime(addDays(baseDate, 41), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 42), 17)),
    parentId: null,
    sequence: '13',
    dependencies: [{ targetId: '21', type: 'FS' }],
  },
  {
    id: '23',
    name: 'Community Engagement',
    startDate: formatISO(setTime(addDays(baseDate, 41), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 43), 17)),
    parentId: null,
    sequence: '14',
    dependencies: [{ targetId: '21', type: 'SS' }],
  },
  {
    id: '24',
    name: 'Feature Iteration Planning',
    startDate: formatISO(setTime(addDays(baseDate, 44), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 45), 17)),
    parentId: null,
    sequence: '15',
    dependencies: [{ targetId: '22', type: 'FF' }],
  },
  {
    id: '25',
    name: 'Additional Module Development',
    startDate: formatISO(setTime(addDays(baseDate, 46), 9)),
    endDate: formatISO(setTime(addDays(baseDate, 48), 17)),
    parentId: '24',
    sequence: '15.1',
    dependencies: [{ targetId: '24', type: 'FS' }],
  },
];

export default sourceTasks;
