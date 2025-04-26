# @jaeungkim/gantt-chart

<!-- ![React Gantt Chart](https://raw.githubusercontent.com/jaeungkim/gantt-chart/main/public/readmeImg.png) -->

Lightweight, high-performance Gantt chart component for React applications, for fast rendering and state management. It is designed to be highly customizable and easy to integrate into modern React projects.

## 🎯 Motivation

I originally wanted to use Microsoft Project's Gantt Chart for personal project management, but it required subscription 😔. Thus, I decided to build my own Gantt chart, referencing various open-source projects and examples, including MS Project, DHTMLX, Frappe Gantt Chart, and etc.

Since there aren’t many open-source Gantt chart solutions available, I hope this project will be useful for others as well. I am very open to feedback, feature requests, and contributions to make this Gantt chart as robust and versatile as possible.

Currently, this project is built specifically for React due to my development background, but in the future, I may explore making it available for other frameworks as well. Since this is my first open-source project, I look forward to learning and improving it with the community!

## ✨ Features

- 📆 Supports multiple timeline scales: Day, Week, Month, Year
- 🔄 Drag-and-drop resizing (snap to configured intervals)
- 🧲 Smart dependency lines (Finish-Start, Start-Start, Start-Finish, Finish-Finish)
- 📦 Lightweight and framework-agnostic component design

## 📺 [Demo is worth a thousand words](https://jaeungkim.com/gantt-chart)

## 🚀 Getting Started

### Installation

```bash
npm install @jaeungkim/gantt-chart
# or
yarn add @jaeungkim/gantt-chart
```

```ts
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { Task } from '@jaeungkim/gantt-chart';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

const tasks: Task[] = [
  {
    id: '1',
    name: 'Project Kickoff',
    startDate: '2024-06-01T09:00:00Z',
    endDate: '2024-06-01T11:00:00Z',
    parentId: null,
    sequence: '1',
    dependencies: [{ targetId: '1', type: 'FS' }],
  },
 ...
];

export default function Example() {
  return (
    <div style={{ width: 'auto', height: '100dvh' }}>
      <ReactGanttChart
        tasks={tasks}
        ganttHeight="100%"
        columnWidth="100%"
        onTasksChange={(updated) => console.log(updated)}
      />
    </div>
  );
}
```

### Props

| Prop            | Type                             | Description                                    |
| --------------- | -------------------------------- | ---------------------------------------------- |
| `tasks`         | `Task[]`                         | Array of task objects to render                |
| `onTasksChange` | `(updatedTasks: Task[]) => void` | Callback fired when a task is moved or resized |
| `ganttHeight`   | `number \| string`               | Height of the chart (`number` or `string`)     |
| `columnWidth`   | `number \| string`               | Width of the chart (`number` or `string`)      |

### Task Format

All dates must be in **UTC ISO string format**, like: `"2024-06-01T09:00:00Z"`.
Internally, dates are parsed and converted to local time using `dayjs`.

```ts
interface Task {
  id: string;
  name: string;
  startDate: string; // UTC ISO string
  endDate: string;   // UTC ISO string
  parentId: string | null;
  sequence: string;
  dependencies?: TaskDependency[];
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

interface TaskDependency {
  targetId: string;
  type: DependencyType;
}
```

## Timeline Scales

The chart supports four built-in scales:

- **`day`**
  - Label: Day
  - Tick Unit: Hour
  - Drag Step: 15 minutes

- **`week`**
  - Label: Week
  - Tick Unit: Day
  - Drag Step: 6 hours

- **`month`**
  - Label: Month
  - Tick Unit: Day
  - Drag Step: 1 day

- **`year`**
  - Label: Year
  - Tick Unit: 7 days
  - Drag Step: 1 day

You can switch between them using the dropdown at the top-right of the chart.

## Customization

Currently at this stage it's not quite customizable other than importing your own tasks.
But in near future, I will definitely make it customizable with adding features like

- Timeline structure (`setupTimelineStructure`)
- Header display (`GanttChartHeader`)
- Bar visuals (`GanttBar`)
- Tick intervals, formats, and drag steps (`GANTT_SCALE_CONFIG`)

Stay Tuned~

##  Roadmap

- [ ] Left sidebar for displaying tasks' names
- [ ] Right sidebar for selected tasks' to view their information
- [ ] Collapsible parent-child rows
- [ ] Virtualized rows for large datasets
- [ ] Inline editing for task names
- [ ] Export to PNG or SVG

## 🤝 Contributing

Pull requests are welcome!
If you find bugs or have suggestions, feel free to open an issue or contribute directly.


## 📄 License

MIT © [jaeungkim](https://github.com/jaeungkim)
