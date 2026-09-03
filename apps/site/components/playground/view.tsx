'use client';

import {
  ReactGanttChart,
  type GanttHandle,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_ANCHOR, demoHolidays, demoTasks } from '@/components/demo/tasks';
import {
  CONTROLS,
  DEFAULTS,
  GROUPS,
  readSettings,
  writeSettings,
  type Settings,
  type SelectValue,
} from '@/components/playground/controls';

const status = (task: Task) =>
  task.progress === 100 ? 'Done' : (task.progress ?? 0) > 0 ? 'In progress' : 'Not started';

// The console floats over the chart, so it follows the chart's own overlay language rather than
// the site's card: one step lifted off the chart background (#fafafa -> white, #09090b -> zinc
// 900), a hairline ring, and a shadow that does the separating. `dark:` here is fumadocs' `.dark`
// class, not the media query, so both follow the site's theme switch rather than the OS.
const HAIRLINE = 'border-black/[0.07] dark:border-white/[0.08]';

const SURFACE = `border bg-white dark:bg-[#18181b] ${HAIRLINE}`;

const DOCK = `${SURFACE} rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05),0_8px_20px_-6px_rgba(0,0,0,0.22)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_10px_28px_-8px_rgba(0,0,0,0.75)]`;

const PANEL = `${SURFACE} rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_44px_-14px_rgba(0,0,0,0.3)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.55),0_22px_52px_-16px_rgba(0,0,0,0.85)]`;

// Every interactive surface is the same tinted fill over the panel, so nothing needs its own
// colour: black at 2-7% in light, white at 3-9% in dark.
const FILL =
  'bg-black/[0.02] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08]';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-console-accent/45';

// Round, filled on hover, dented on press - the shape agentation's toolbar uses.
const ICON_BUTTON =
  `grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-fd-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-black/[0.06] hover:text-fd-foreground active:scale-[0.92] dark:hover:bg-white/[0.08] ${FOCUS}`;

const ACTION =
  `h-7 rounded-lg border px-2.5 text-[12px] font-medium text-fd-muted-foreground transition-[background-color,color,transform] duration-150 hover:text-fd-foreground active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/[0.02] disabled:hover:text-fd-muted-foreground disabled:active:scale-100 dark:disabled:hover:bg-white/[0.03] ${HAIRLINE} ${FILL} ${FOCUS}`;

const HEADING = 'text-[10px] font-semibold uppercase tracking-[0.09em] text-fd-muted-foreground';

// A fixed 32px row is the whole rhythm of the panel - every control sits on the same baseline.
const ROW = 'flex h-8 items-center justify-between gap-3 text-[12.5px] text-fd-foreground';

const DIVIDER = `border-t ${HAIRLINE}`;

// The track is a sibling of the visually hidden input, so `peer-checked` drives both it and the
// knob it paints with `::after`.
const SWITCH =
  'relative h-4 w-7 shrink-0 rounded-full bg-black/[0.18] transition-colors duration-200 after:absolute after:left-[2px] after:top-[2px] after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(0,0,0,0.3)] after:transition-transform after:duration-200 peer-checked:bg-console-accent peer-checked:after:translate-x-3 peer-focus-visible:ring-2 peer-focus-visible:ring-console-accent/45 dark:bg-white/20';

const SELECT =
  `h-7 w-[7.5rem] cursor-pointer rounded-lg border px-2 text-[12px] text-fd-foreground transition-colors duration-150 ${HAIRLINE} ${FILL} ${FOCUS}`;

const Icon = ({ children, className = 'size-4' }: { children: ReactNode; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export function PlaygroundView() {
  const ref = useRef<GanttHandle>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Seeded straight from the query string - this module never renders on the server.
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [selected, setSelected] = useState<TaskTransformed | null>(null);
  const [range, setRange] = useState<string>('-');
  useEffect(() => writeSettings(settings), [settings]);

  // An overlay pinned over the viewport, not requestFullscreen, so the exit control stays visible.
  useEffect(() => {
    if (!fullscreen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  // The store's equality guard makes a scale change that came from the chart a no-op, not a loop.
  useEffect(() => {
    ref.current?.setScale(settings.scale);
  }, [settings.scale]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const reset = () => {
    setTasks(demoTasks);
    setSelected(null);
  };

  // A fresh array every render would make the chart recompute its non-working days each time.
  const holidays = useMemo(
    () => (settings.holidays ? demoHolidays : undefined),
    [settings.holidays]
  );

  const first = tasks.find((task) => task.parentId !== null) ?? tasks[0];

  // `scrollToToday()` no-ops off-range; both sides stay UTC `YYYY-MM-DD` so the string compare holds.
  const [rangeStart, rangeEnd] = range.split(' .. ');
  const today = new Date().toISOString().slice(0, 10);
  const todayInRange = Boolean(rangeEnd) && rangeStart <= today && today <= rangeEnd;

  return (
    // 3.5rem is HomeLayout's `h-14` navbar; z-50 clears Fumadocs' sticky nav, which sits at z-40.
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 w-full overflow-hidden bg-fd-background'
          : 'relative h-[calc(100svh-3.5rem)] w-full overflow-hidden bg-fd-background'
      }
    >
      <div
        className="bg-fd-card"
        style={{
          height: settings.chartHeight === 'fill' ? '100%' : `${settings.chartHeight}px`,
        }}
      >
        <ReactGanttChart
          ref={ref}
          tasks={tasks}
          onTasksChange={setTasks}
          onTaskCreate={(draft) => {
            // The chart adds nothing itself - the host appends the row.
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
          onTaskSelect={setSelected}
          onRangeChange={(next) =>
            setRange(`${next.start.format('YYYY-MM-DD')} .. ${next.end.format('YYYY-MM-DD')}`)
          }
          readOnly={settings.readOnly}
          // Each `allow*` beats `readOnly`, so only the off state is passed through.
          allowMove={settings.allowMove ? undefined : false}
          allowResize={settings.allowResize ? undefined : false}
          allowProgressChange={settings.allowProgressChange ? undefined : false}
          allowLinkCreate={settings.allowLinkCreate ? undefined : false}
          allowLinkDelete={settings.allowLinkDelete ? undefined : false}
          allowTaskCreate={settings.allowTaskCreate ? undefined : false}
          allowReorder={settings.reorder}
          height="100%"
          width="100%"
          showTaskList={settings.showTaskList}
          showRowNumbers={settings.showRowNumbers}
          showDetail={settings.showDetail}
          defaultScale={DEFAULTS.scale}
          initialScrollTo={DEMO_ANCHOR}
          // Keeps the console's `scale` row honest when ctrl+wheel or zoomToFit moves the scale.
          onScaleChange={(scale) => update('scale', scale)}
          // 'host' means "no prop" - the chart then inherits the site's color-scheme.
          theme={settings.theme === 'host' ? undefined : settings.theme}
          locale={settings.locale}
          firstDayOfWeek={Number(settings.firstDayOfWeek)}
          hierarchy={settings.hierarchy}
          groupBy={settings.groupBy ? status : undefined}
          showNonWorkingDays={settings.showNonWorkingDays}
          holidays={holidays}
          workingCalendar={settings.workingCalendar}
          autoScrollOnDrag={settings.autoScrollOnDrag}
          showTooltip={settings.showTooltip}
          zoomOnWheel={settings.zoomOnWheel}
          infiniteScroll={settings.infiniteScroll}
        />
      </div>

      {/* One dock carries both toggles and anchors the panel, so the corner holds a single object
          rather than two stacked buttons. z-index clears every chart layer and stays under
          Agentation's 100000. */}
      <div
        className={`absolute bottom-4 left-4 z-[1000] flex items-center gap-1 p-1 ${DOCK}`}
      >
        {/* Native <details>: controls stay in the DOM while closed, so a test clicks
            `console-toggle` first. `contents` keeps the summary in the dock's own flex row. */}
        <details data-testid="console" className="group/console contents">
          <summary
            data-testid="console-toggle"
            title="Console"
            aria-label="Toggle the console"
            className={`${ICON_BUTTON} list-none group-open/console:bg-console-accent/10 group-open/console:text-console-accent [&::-webkit-details-marker]:hidden`}
          >
            <Icon>
              <path d="M4 6h9M17.5 6H20M4 12h2.5M11 12h9M4 18h9M17.5 18H20" />
              <circle cx="13" cy="6" r="2" />
              <circle cx="8.5" cy="12" r="2" />
              <circle cx="13" cy="18" r="2" />
            </Icon>
          </summary>

          <div
            className={`absolute bottom-[calc(100%+0.625rem)] left-0 flex max-h-[min(40rem,calc(100svh-8rem))] w-[21rem] max-w-[calc(100vw-2rem)] origin-bottom-left flex-col overflow-hidden text-[12.5px] motion-safe:animate-console-in ${PANEL}`}
          >
            <header
              className={`flex h-10 shrink-0 items-center gap-2 border-b px-3.5 ${HAIRLINE}`}
            >
              <span className="size-1.5 rounded-full bg-console-accent" />
              <h2 className="text-[12px] font-semibold tracking-tight text-fd-foreground">
                Console
              </h2>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-fd-muted-foreground">
                {tasks.length} tasks &middot; {settings.scale}
              </span>
            </header>

            <div className="console-scroll flex flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 [&>*]:shrink-0">
              <div data-testid="actions" className="flex flex-wrap items-center gap-1.5 py-3">
                <button
                  type="button"
                  className={ACTION}
                  disabled={!todayInRange}
                  title={
                    todayInRange
                      ? undefined
                      : 'Today is outside the rendered range, so scrollToToday() is a documented no-op'
                  }
                  onClick={() => ref.current?.scrollToToday()}
                >
                  Today
                </button>
                <button type="button" className={ACTION} onClick={() => ref.current?.zoomToFit()}>
                  Fit
                </button>
                <button
                  type="button"
                  className={ACTION}
                  disabled={!first}
                  onClick={() => first && ref.current?.scrollToTask(first.id)}
                >
                  Scroll to {first?.id}
                </button>
                <button
                  type="button"
                  className={ACTION}
                  disabled={!settings.showDetail || !first}
                  title={settings.showDetail ? undefined : 'Turn the detail panel on first'}
                  onClick={() => first && ref.current?.openDetail(first.id)}
                >
                  Open detail
                </button>
                <button
                  type="button"
                  className={ACTION}
                  // `readOnly` blocks creation too, so the button follows both switches.
                  disabled={!settings.allowTaskCreate || settings.readOnly}
                  title={
                    settings.allowTaskCreate && !settings.readOnly
                      ? undefined
                      : 'Turn task creation on first'
                  }
                  onClick={() => ref.current?.addTask()}
                >
                  Add task
                </button>
                <button type="button" className={ACTION} onClick={reset}>
                  Reset data
                </button>
              </div>

              {/* The header already carries the task count and the scale, so this holds only what
                  it does not repeat - and reads as two more rows rather than a second layout. */}
              <dl data-testid="stats" className="pb-3">
                {(
                  [
                    ['Selected', selected?.id ?? '-'],
                    ['Rendered range', range],
                  ] as const
                ).map(([term, value]) => (
                  <div key={term} className={ROW}>
                    <dt className={HEADING}>{term}</dt>
                    <dd className="truncate font-mono text-[11.5px] text-fd-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {GROUPS.map((group) => (
                // Open by default; collapsing a group is how the wall of switches gets down to
                // the handful a given experiment needs.
                <details
                  key={group}
                  open
                  className={`console-section group/section ${DIVIDER}`}
                >
                  <summary
                    className={`${HEADING} flex h-8 cursor-pointer list-none items-center gap-1.5 transition-colors duration-150 hover:text-fd-foreground [&::-webkit-details-marker]:hidden`}
                  >
                    <Icon className="size-3 transition-transform duration-200 group-open/section:rotate-90">
                      <path d="m9 6 6 6-6 6" />
                    </Icon>
                    {group}
                  </summary>
                  <div className="pb-2.5">
                    {CONTROLS.filter((control) => control.group === group).map((control) =>
                      control.type === 'boolean' ? (
                        // The hint is the row's tooltip, not a second line - two lines a switch
                        // turned the panel into prose you had to scroll past to reach a control.
                        <label
                          key={control.key}
                          className={`${ROW} cursor-pointer`}
                          title={control.hint}
                        >
                          <span>{control.label}</span>
                          <input
                            data-testid={control.key}
                            type="checkbox"
                            className="peer sr-only"
                            checked={settings[control.key]}
                            onChange={(e) => update(control.key, e.target.checked)}
                          />
                          <span className={SWITCH} />
                        </label>
                      ) : (
                        <label key={control.key} className={ROW} title={control.hint}>
                          <span>{control.label}</span>
                          <select
                            data-testid={control.key}
                            className={SELECT}
                            value={settings[control.key]}
                            onChange={(e) => update(control.key, e.target.value as SelectValue)}
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
                  </div>
                </details>
              ))}
            </div>
          </div>
        </details>

        <span className="mx-0.5 h-5 w-px bg-black/[0.09] dark:bg-white/[0.12]" />

        <button
          type="button"
          data-testid="fullscreen-toggle"
          aria-pressed={fullscreen}
          title={fullscreen ? 'Leave fullscreen (Esc)' : 'Fill the window'}
          aria-label={fullscreen ? 'Leave fullscreen' : 'Fill the window'}
          className={`${ICON_BUTTON} aria-pressed:bg-console-accent/10 aria-pressed:text-console-accent`}
          onClick={() => setFullscreen((current) => !current)}
        >
          <Icon>
            {fullscreen ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
            )}
          </Icon>
        </button>
      </div>
    </div>
  );
}
