'use client';

import type { GanttProps, Task } from '@jaeungkim/gantt-chart';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { demoHolidays, demoTasks } from '@/components/demo/tasks';

const ReactGanttChart = dynamic<GanttProps>(
  () => import('@jaeungkim/gantt-chart').then((m) => m.ReactGanttChart),
  { ssr: false }
);

const PRESETS = {
  basic: { hierarchy: false, showTaskList: true },
  hierarchy: { hierarchy: true, showTaskList: true },
  rowNumbers: { hierarchy: true, showTaskList: true, showRowNumbers: true },
  dependencies: { hierarchy: true, showTaskList: false },
  workingCalendar: {
    hierarchy: true,
    showTaskList: true,
    workingCalendar: true,
    holidays: demoHolidays,
  },
  holidays: { hierarchy: true, showTaskList: true, holidays: demoHolidays },
  detail: { showTaskList: true, showDetail: true },
  showcase: {
    hierarchy: true,
    showTaskList: true,
    showRowNumbers: true,
    workingCalendar: true,
    holidays: demoHolidays,
    showDetail: true,
    zoomOnWheel: true,
  },
  zoom: { hierarchy: true, zoomOnWheel: true },
  locale: { hierarchy: true, showTaskList: true, locale: 'ko-KR' },
  dark: { hierarchy: true, showTaskList: true, theme: 'dark' },
  compact: { hierarchy: true, showTaskList: true, rowHeight: 28 },
  readOnly: { hierarchy: true, showTaskList: true, readOnly: true },
} as const satisfies Record<string, Partial<GanttProps>>;

type GanttDemoPreset = keyof typeof PRESETS;

interface GanttDemoProps {
  preset?: GanttDemoPreset;
  height?: number;
}

export function GanttDemo({ preset = 'basic', height = 380 }: GanttDemoProps) {
  const [tasks, setTasks] = useState<Task[]>(demoTasks);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-fd-border">
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        height={height}
        width="100%"
        defaultScale="month"
        initialScrollTo="today"
        {...PRESETS[preset]}
      />
    </div>
  );
}
