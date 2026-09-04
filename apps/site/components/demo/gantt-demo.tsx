'use client';

import type { GanttProps, Task } from '@jaeungkim/gantt-chart';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { demoHolidays, demoTasks } from '@/components/demo/tasks';

// The chart measures the DOM on mount, so it never server-renders.
const ReactGanttChart = dynamic<GanttProps>(
  () => import('@jaeungkim/gantt-chart').then((m) => m.ReactGanttChart),
  { ssr: false }
);

// Presets vary props against one shared fixture; add a preset here, never another copy of the data.
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
  // Left on the default 'month' scale on purpose: there the three-day shutdown's band is wide
  // enough to hold its name and the one-day offsite's is not, so hovering it in the header is
  // the only way to read that one.
  holidays: { hierarchy: true, showTaskList: true, holidays: demoHolidays },
  detail: { showTaskList: true, showDetail: true },
  // The landing page's one demo, so it turns on what the feature list claims: the hierarchy with
  // its rolled-up summary rows, numbered rows, the working-day calendar, the detail panel and
  // Ctrl/Cmd + wheel zoom.
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
        // Centred, and today sits mid-fixture, so a demo opens on the whole project
        initialScrollTo="today"
        {...PRESETS[preset]}
      />
    </div>
  );
}
