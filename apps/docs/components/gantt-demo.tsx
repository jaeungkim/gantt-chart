'use client';

import type { GanttProps, Task } from '@jaeungkim/gantt-chart';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { DEMO_ANCHOR, demoTasks } from '@/components/demo-tasks';

// The chart measures the DOM on mount, so it never server-renders.
const ReactGanttChart = dynamic<GanttProps>(
  () => import('@jaeungkim/gantt-chart').then((m) => m.ReactGanttChart),
  { ssr: false }
);

/**
 * Presets vary props against one shared fixture, so a page shows the feature it is about
 * without restating the whole data set. Add a preset here, not another copy of the data.
 */
const PRESETS = {
  basic: { hierarchy: false, showTaskList: true },
  hierarchy: { hierarchy: true, showTaskList: true },
  dependencies: { hierarchy: true, showTaskList: false },
  scheduling: {
    hierarchy: true,
    showTaskList: true,
    criticalPath: true,
    schedulingPolicy: 'shift-on-overlap',
  },
  grouping: { hierarchy: false, showTaskList: true },
  readOnly: { hierarchy: true, showTaskList: true, readOnly: true },
} as const satisfies Record<string, Partial<GanttProps>>;

export type GanttDemoPreset = keyof typeof PRESETS;

const byProgress = (task: Task) =>
  task.progress === 100 ? 'Done' : (task.progress ?? 0) > 0 ? 'In progress' : 'Not started';

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
        initialScrollTo={DEMO_ANCHOR}
        // Every demo shares a page origin, and the scale selection is persisted per
        // storageKey. Without a key of its own, changing the scale on one page would
        // silently change it on every other demo across the site.
        storageKey={`gantt-docs-${preset}`}
        groupBy={preset === 'grouping' ? byProgress : undefined}
        {...PRESETS[preset]}
      />
    </div>
  );
}
