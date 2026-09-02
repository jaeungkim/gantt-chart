'use client';

import type { GanttProps, SchedulingPolicy, Task } from '@jaeungkim/gantt-chart';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { DEMO_ANCHOR, demoTasks } from '@/components/demo-tasks';

const ReactGanttChart = dynamic<GanttProps>(
  () => import('@jaeungkim/gantt-chart').then((m) => m.ReactGanttChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] items-center justify-center text-sm text-fd-muted-foreground">
        Loading chart…
      </div>
    ),
  }
);

/**
 * The public playground. Every switch is one row here and rendered by a single loop, so a
 * new feature means a new row rather than another block of JSX - the same shape the dev
 * playground uses. Only real product features appear; the dev-only escape hatches
 * (veto, custom bar renderers) stay out of the shipped site.
 */
interface Settings {
  hierarchy: boolean;
  groupBy: boolean;
  criticalPath: boolean;
  workingCalendar: boolean;
  readOnly: boolean;
  policy: SchedulingPolicy;
  locale: string;
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

type Control =
  | { key: BooleanKey; label: string; hint: string; type: 'boolean' }
  | {
      key: Exclude<keyof Settings, BooleanKey>;
      label: string;
      hint: string;
      type: 'select';
      options: readonly string[];
    };

const CONTROLS: readonly Control[] = [
  {
    key: 'hierarchy',
    label: 'Hierarchy',
    hint: 'Derive summary rows from parentId',
    type: 'boolean',
  },
  {
    key: 'criticalPath',
    label: 'Critical path',
    hint: 'Highlight the chain with zero slack',
    type: 'boolean',
  },
  {
    key: 'workingCalendar',
    label: 'Working calendar',
    hint: 'Skip weekends when scheduling',
    type: 'boolean',
  },
  {
    key: 'groupBy',
    label: 'Swimlanes',
    hint: 'Group rows by progress',
    type: 'boolean',
  },
  {
    key: 'readOnly',
    label: 'Read only',
    hint: 'Freeze every gesture',
    type: 'boolean',
  },
  {
    key: 'policy',
    label: 'Scheduling policy',
    hint: 'What successors do when a bar moves',
    type: 'select',
    options: ['off', 'shift-on-overlap', 'maintain-gap'],
  },
  {
    key: 'locale',
    label: 'Locale',
    hint: 'Header and tooltip formatting',
    type: 'select',
    options: ['en-US', 'ko-KR'],
  },
];

const DEFAULTS: Settings = {
  hierarchy: true,
  groupBy: false,
  criticalPath: true,
  workingCalendar: false,
  readOnly: false,
  policy: 'shift-on-overlap',
  locale: 'en-US',
};

const byProgress = (task: Task) =>
  task.progress === 100 ? 'Done' : (task.progress ?? 0) > 0 ? 'In progress' : 'Not started';

export function Playground() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [tasks, setTasks] = useState<Task[]>(demoTasks);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        <ReactGanttChart
          tasks={tasks}
          onTasksChange={setTasks}
          height={440}
          width="100%"
          defaultScale="month"
          initialScrollTo={DEMO_ANCHOR}
          storageKey="gantt-playground"
          hierarchy={settings.hierarchy}
          criticalPath={settings.criticalPath}
          workingCalendar={settings.workingCalendar}
          readOnly={settings.readOnly}
          schedulingPolicy={settings.policy}
          locale={settings.locale}
          groupBy={settings.groupBy ? byProgress : undefined}
          showTaskList
          allowRowReorder
          zoomOnWheel
        />
      </div>

      <aside className="flex flex-col gap-1 rounded-xl border border-fd-border bg-fd-card p-3">
        <p className="px-1 pb-2 text-xs font-medium text-fd-muted-foreground">
          Drag a bar, resize an edge, or draw a dependency between two rows.
        </p>

        {CONTROLS.map((control) =>
          control.type === 'boolean' ? (
            <label
              key={control.key}
              className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-fd-accent"
              title={control.hint}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-fd-primary"
                checked={settings[control.key]}
                onChange={(e) => update(control.key, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm">{control.label}</span>
                <span className="block text-xs text-fd-muted-foreground">{control.hint}</span>
              </span>
            </label>
          ) : (
            <label key={control.key} className="flex flex-col gap-1 p-2">
              <span className="text-sm">{control.label}</span>
              <select
                className="rounded-md border border-fd-border bg-fd-background px-2 py-1 text-sm"
                value={settings[control.key]}
                onChange={(e) =>
                  update(control.key, e.target.value as SchedulingPolicy & string)
                }
              >
                {control.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="text-xs text-fd-muted-foreground">{control.hint}</span>
            </label>
          )
        )}

        <button
          type="button"
          onClick={() => {
            setTasks(demoTasks);
            setSettings(DEFAULTS);
          }}
          className="mt-1 rounded-lg border border-fd-border px-3 py-1.5 text-sm hover:bg-fd-accent"
        >
          Reset
        </button>
      </aside>
    </div>
  );
}
