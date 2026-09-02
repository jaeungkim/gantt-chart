import { Agentation } from 'agentation';
import {
  ReactGanttChart,
  type GanttBarRenderProps,
  type GanttColumn,
  type GanttHandle,
  type GanttMarker,
  type GanttRangeBand,
  type SchedulingPolicy,
  type Task,
} from '@jaeungkim/gantt-chart';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { seedTasks } from './db';

/**
 * Dev playground - not part of the published package.
 *
 * Root `src/` is the package. This app imports it by its published name, which vite.config.ts
 * aliases to `../src` so edits hot-reload without a build; `apps/docs` consumes `dist/` instead,
 * to show what npm actually serves.
 *
 * The chart fills the window. Every switch lives in the dev console - the gear button bottom-left
 * (Agentation owns bottom-right) - and is declared once in CONTROLS and rendered by one loop, so
 * adding a feature to the harness means adding a row, not another block of JSX. Settings live in
 * React state and are mirrored into the query string, so a scenario is a shareable link
 * (`?criticalPath=1&policy=shift-on-overlap`) that still toggles live once loaded.
 *
 * The console is a native <details>, so its inputs are in the DOM but hidden while it is closed:
 * a test has to click `data-testid="dev-panel-toggle"` before touching the control testids.
 */

interface Settings {
  hierarchy: boolean;
  groupBy: boolean;
  criticalPath: boolean;
  workingCalendar: boolean;
  readOnly: boolean;
  reject: boolean;
  customBar: boolean;
  policy: SchedulingPolicy;
  locale: string;
  firstDayOfWeek: string;
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];
type SelectKey = Exclude<keyof Settings, BooleanKey>;

type Control =
  | { key: BooleanKey; label: string; type: 'boolean' }
  | { key: SelectKey; label: string; type: 'select'; options: readonly string[] };

const CONTROLS: readonly Control[] = [
  { key: 'hierarchy', label: 'hierarchy', type: 'boolean' },
  { key: 'groupBy', label: 'swimlanes', type: 'boolean' },
  { key: 'criticalPath', label: 'critical path', type: 'boolean' },
  { key: 'workingCalendar', label: 'working calendar', type: 'boolean' },
  { key: 'readOnly', label: 'read only', type: 'boolean' },
  { key: 'reject', label: 'reject changes', type: 'boolean' },
  { key: 'customBar', label: 'custom bar', type: 'boolean' },
  {
    key: 'policy',
    label: 'policy',
    type: 'select',
    options: ['off', 'shift-on-overlap', 'maintain-gap'],
  },
  { key: 'locale', label: 'locale', type: 'select', options: ['en-US', 'ko-KR'] },
  {
    key: 'firstDayOfWeek',
    label: 'week starts',
    type: 'select',
    options: ['0', '1', '6'],
  },
];

const DEFAULTS: Settings = {
  hierarchy: true,
  groupBy: false,
  criticalPath: false,
  workingCalendar: false,
  readOnly: false,
  reject: false,
  customBar: false,
  policy: 'off',
  locale: 'en-US',
  firstDayOfWeek: '1',
};

/** Read settings out of the query string, falling back to DEFAULTS for anything absent. */
function readSettings(): Settings {
  const params = new URLSearchParams(window.location.search);
  const next = { ...DEFAULTS };

  for (const control of CONTROLS) {
    const raw = params.get(control.key);
    if (raw === null) continue;

    if (control.type === 'boolean') {
      next[control.key] = raw !== '0' && raw !== 'false';
    } else if (control.options.includes(raw)) {
      // Narrowed by the options list, so `policy` cannot be handed an unknown string
      next[control.key] = raw as SchedulingPolicy & string;
    }
  }

  return next;
}

/** Mirror the non-default settings back into the URL, so the current view is linkable. */
function writeSettings(settings: Settings): void {
  const params = new URLSearchParams();

  for (const control of CONTROLS) {
    const value = settings[control.key];
    if (value === DEFAULTS[control.key]) continue;
    // `hierarchy` defaults to on, so its non-default value is `false` - serialize the
    // actual value rather than assuming non-default means "1".
    params.set(control.key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  }

  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    query ? `${window.location.pathname}?${query}` : window.location.pathname
  );
}

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const markers: GanttMarker[] = [
  { id: 'release', date: day(9), label: 'Release 1.0' },
  { id: 'deadline', date: day(4), label: 'Deadline', warnOnOverrun: true },
];

const rangeBands: GanttRangeBand[] = [
  { id: 'sprint-1', startDate: day(-2), endDate: day(5), label: 'Sprint 1' },
];

const status = (task: Task) =>
  task.progress === 100
    ? 'Done'
    : (task.progress ?? 0) > 0
      ? 'In progress'
      : 'Not started';

const columns: GanttColumn[] = [
  { key: 'name', header: 'Name', width: 200 },
  { key: 'sequence', header: '#', width: 44 },
  {
    key: 'duration',
    header: 'Span',
    width: 56,
    render: (task) => task.duration ?? '',
  },
  {
    key: 'totalSlack',
    header: 'Slack',
    width: 60,
    render: (task) => (task.totalSlack === undefined ? '' : task.totalSlack),
  },
  {
    key: 'critical',
    header: 'Crit',
    width: 50,
    render: (task) => (task.critical ? 'yes' : ''),
  },
];

/**
 * Dev console: a <details> pinned bottom-left. The browser owns open/closed, so there is no
 * state, portal or key handler. `attention` lights a dot on the button while a readout inside
 * needs a look, since a closed panel would otherwise hide it.
 */
function DevPanel({ children, attention }: { children: ReactNode; attention?: boolean }) {
  return (
    <details className="dev-panel" data-testid="dev-panel">
      <summary
        data-testid="dev-panel-toggle"
        title="Dev console"
        aria-label="Toggle dev console"
        data-attention={attention || undefined}
      >
        &#9881;
      </summary>
      <div className="dev-panel-body">{children}</div>
    </details>
  );
}

function App() {
  const ref = useRef<GanttHandle>(null);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [cycle, setCycle] = useState<string[] | null>(null);
  const [lastChange, setLastChange] = useState<string>('');

  useEffect(() => writeSettings(settings), [settings]);

  // Playground convenience - `gantt.current.scrollToToday()` from the devtools console.
  // The ref object itself, not its value: the handle behind it is rebuilt as data changes.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).gantt = ref;
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div style={{ height: '100svh' }}>
        <ReactGanttChart
          ref={ref}
          tasks={tasks}
          onTasksChange={(updated) => {
            console.info('[gantt] onTasksChange', updated.length);
            setTasks(updated);
          }}
          onDependencyCreate={(change) => {
            console.info('[gantt] onDependencyCreate', JSON.stringify(change));
            if (settings.reject) return false;
          }}
          onDependencyDelete={(change) => {
            console.info('[gantt] onDependencyDelete', JSON.stringify(change));
            if (settings.reject) return false;
          }}
          onTaskCreate={(draft) => {
            console.info('[gantt] onTaskCreate', JSON.stringify(draft));
            if (settings.reject) return;

            // The chart adds nothing itself - the host decides, here by appending a row
            setTasks((current) => [
              ...current,
              {
                id: `new-${current.length + 1}`,
                name: 'New task',
                startDate: draft.startDate,
                endDate: draft.endDate,
                parentId: null,
                sequence: `${current.length + 1}`,
              },
            ]);
          }}
          readOnly={settings.readOnly}
          height="100%"
          width="100%"
          showTaskList
          columns={columns}
          defaultScale="month"
          locale={settings.locale}
          firstDayOfWeek={Number(settings.firstDayOfWeek)}
          hierarchy={settings.hierarchy}
          groupBy={settings.groupBy ? status : undefined}
          allowRowReorder
          schedulingPolicy={settings.policy}
          onSchedulingCycle={setCycle}
          workingCalendar={settings.workingCalendar}
          criticalPath={settings.criticalPath}
          zoomOnWheel
          infiniteScroll
          markers={markers}
          rangeBands={rangeBands}
          onBeforeTaskChange={(change) => {
            setLastChange(
              `${change.type}:${change.changedTasks.map((t) => t.id).join(',')}`
            );
            return settings.reject ? Promise.resolve(false) : undefined;
          }}
          renderBar={
            settings.customBar
              ? ({ task, barProps }: GanttBarRenderProps) => (
                  <div {...barProps} className="demo-bar" data-id={task.id}>
                    {task.name}
                  </div>
                )
              : undefined
          }
        />
      </div>

      {import.meta.env.DEV && (
        <DevPanel attention={cycle !== null}>
          {CONTROLS.map((control) =>
            control.type === 'boolean' ? (
              <label key={control.key}>
                <input
                  data-testid={control.key}
                  type="checkbox"
                  checked={settings[control.key]}
                  onChange={(e) => update(control.key, e.target.checked)}
                />{' '}
                {control.label}
              </label>
            ) : (
              <label key={control.key}>
                {control.label}{' '}
                <select
                  data-testid={control.key}
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
              </label>
            )
          )}

          <button
            type="button"
            onClick={() => {
              setTasks(seedTasks);
              setCycle(null);
            }}
          >
            Reset dates
          </button>

          <span data-testid="last-change">{lastChange}</span>
          {cycle && <span data-testid="cycle">cycle: {cycle.join(' -> ')}</span>}
        </DevPanel>
      )}

      <Agentation />
    </>
  );
}

export default App;
