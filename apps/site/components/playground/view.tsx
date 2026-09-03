'use client';

import {
  ReactGanttChart,
  type GanttHandle,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

// Newest first, capped - a long drag fires a lot of callbacks.
const LOG_LIMIT = 120;

interface LogEntry {
  id: number;
  at: string;
  event: string;
  detail: string;
}

// The dock floats over the chart, so it is glass; the panel has to stay readable over dense
// rows, so it is not. `dark:` here is fumadocs' `.dark` class, not the media query, so both
// follow the site's own theme switch rather than the OS.
const DOCK =
  'border border-fd-border/70 bg-fd-card/80 backdrop-blur-xl dark:border-white/10 dark:bg-fd-card/70';

const PANEL = 'border border-fd-border/70 bg-fd-card dark:border-white/10';

// Round, filled on hover, dented on press - the shape agentation's toolbar uses.
const ICON_BUTTON =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-fd-muted-foreground outline-none transition-[background-color,color,transform] duration-150 hover:bg-fd-accent hover:text-fd-foreground focus-visible:ring-2 focus-visible:ring-fd-ring active:scale-[0.92]';

const ACTION =
  'rounded-full border border-fd-border/70 px-2.5 py-1 text-[12px] text-fd-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-fd-accent hover:text-fd-foreground active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fd-muted-foreground disabled:active:scale-100';

const HEADING = 'text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fd-muted-foreground';

const ROW = 'flex items-center justify-between gap-3 py-[5px] text-[12.5px] text-fd-foreground';

// The track is a sibling of the visually hidden input, so `peer-checked` drives both it and the
// knob it paints with `::after`.
const SWITCH =
  'relative h-[18px] w-8 shrink-0 rounded-full bg-fd-border transition-colors duration-200 after:absolute after:left-[2px] after:top-[2px] after:size-[14px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:bg-fd-primary peer-checked:after:translate-x-[14px] peer-focus-visible:ring-2 peer-focus-visible:ring-fd-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-fd-card dark:after:bg-fd-card';

const SELECT =
  'h-7 w-[7.5rem] cursor-pointer rounded-lg border border-fd-border/70 bg-fd-background/60 px-2 text-[12px] text-fd-foreground outline-none transition-colors hover:border-fd-border focus-visible:ring-2 focus-visible:ring-fd-ring';

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
  const [log, setLog] = useState<LogEntry[]>([]);
  const logId = useRef(0);
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

  const push = useCallback((event: string, detail: unknown) => {
    setLog((current) =>
      [
        {
          id: logId.current++,
          at: new Date().toLocaleTimeString([], { hour12: false }),
          event,
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail ?? null),
        },
        ...current,
      ].slice(0, LOG_LIMIT)
    );
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const reset = () => {
    setTasks(demoTasks);
    setSelected(null);
    push('reset', 'demo data restored');
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
          onTasksChange={(updated) => {
            push('onTasksChange', `${updated.length} tasks`);
            setTasks(updated);
          }}
          onDependencyCreate={(change) => push('onDependencyCreate', change)}
          onDependencyDelete={(change) => push('onDependencyDelete', change)}
          onTaskCreate={(draft) => {
            push('onTaskCreate', draft);
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
          onTaskMove={(change) => push('onTaskMove', change)}
          onTaskClick={(task) => push('onTaskClick', task.id)}
          onTaskDoubleClick={(task) => push('onTaskDoubleClick', task.id)}
          onTaskSelect={(task) => {
            push('onTaskSelect', task?.id ?? null);
            setSelected(task);
          }}
          onDetailChange={(task) => push('onDetailChange', task?.id ?? null)}
          onCollapsedChange={(ids) => push('onCollapsedChange', ids)}
          onRangeChange={(next) => {
            const label = `${next.start.format('YYYY-MM-DD')} .. ${next.end.format('YYYY-MM-DD')}`;
            setRange(label);
            push('onRangeChange', label);
          }}
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
          showDetail={settings.showDetail}
          detailTrigger={settings.detailTrigger}
          defaultScale={DEFAULTS.scale}
          initialScrollTo={DEMO_ANCHOR}
          // Keeps the console's `scale` row honest when ctrl+wheel or zoomToFit moves the scale.
          onScaleChange={(scale) => update('scale', scale)}
          theme={settings.theme}
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
        className={`absolute bottom-4 left-4 z-[1000] flex items-center gap-1 rounded-full p-1 shadow-lg shadow-black/10 dark:shadow-black/40 ${DOCK}`}
      >
        {/* Native <details>: controls stay in the DOM while closed, so a test clicks
            `console-toggle` first. `contents` keeps the summary in the dock's own flex row. */}
        <details data-testid="console" className="group/console contents">
          <summary
            data-testid="console-toggle"
            title="Console"
            aria-label="Toggle the console"
            className={`${ICON_BUTTON} list-none group-open/console:bg-fd-primary/10 group-open/console:text-fd-primary [&::-webkit-details-marker]:hidden`}
          >
            <Icon>
              <path d="M4 6h9M17.5 6H20M4 12h2.5M11 12h9M4 18h9M17.5 18H20" />
              <circle cx="13" cy="6" r="2" />
              <circle cx="8.5" cy="12" r="2" />
              <circle cx="13" cy="18" r="2" />
            </Icon>
          </summary>

          <div
            className={`absolute bottom-[calc(100%+0.625rem)] left-0 flex max-h-[min(40rem,calc(100svh-8rem))] w-[21rem] max-w-[calc(100vw-2rem)] origin-bottom-left flex-col overflow-hidden rounded-2xl text-[13px] shadow-2xl shadow-black/20 motion-safe:animate-console-in dark:shadow-black/60 ${PANEL}`}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-fd-border/60 px-3.5 py-2.5">
              <span className="size-1.5 rounded-full bg-fd-primary motion-safe:animate-pulse" />
              <h2 className="text-[12px] font-semibold tracking-tight text-fd-foreground">
                Console
              </h2>
              <span className="ml-auto font-mono text-[11px] text-fd-muted-foreground">
                {tasks.length} tasks &middot; {settings.scale}
              </span>
            </header>

            <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 [&>*]:shrink-0">
              <div data-testid="actions" className="flex flex-wrap items-center gap-1.5 py-3">
                <button
                  type="button"
                  className={ACTION}
                  disabled={!todayInRange}
                  title={
                    todayInRange
                      ? undefined
                      : `The demo data is pinned to ${DEMO_ANCHOR}, so today is off the rendered range and scrollToToday() is a documented no-op`
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
                  <div key={term} className={`${ROW} py-1`}>
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
                  className="console-section group/section border-t border-fd-border/50"
                >
                  <summary
                    className={`${HEADING} flex cursor-pointer list-none items-center gap-1.5 py-2.5 transition-colors hover:text-fd-foreground [&::-webkit-details-marker]:hidden`}
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

            {/* Pinned rather than last in the scroll column: the log is what you watch while
                dragging a bar, so it stays on screen wherever the controls are scrolled to. */}
            <section className="shrink-0 border-t border-fd-border/60 bg-fd-muted/40 dark:bg-black/20">
              <h3 className={`${HEADING} flex items-center justify-between px-3.5 py-2`}>
                Event log
                <button
                  type="button"
                  className="text-[10.5px] normal-case tracking-normal underline underline-offset-2 transition-colors hover:text-fd-foreground"
                  onClick={() => setLog([])}
                >
                  Clear
                </button>
              </h3>
              <ol
                data-testid="event-log"
                className="h-24 overflow-y-auto overscroll-contain px-3.5 pb-2.5 font-mono text-[11px] leading-5"
              >
                {log.length === 0 && (
                  <li className="font-sans text-[11.5px] leading-4 text-fd-muted-foreground">
                    Every callback the chart fires shows up here. Drag a bar, draw a link, click a
                    row.
                  </li>
                )}
                {log.map((entry) => (
                  <li key={entry.id} className="flex gap-2 motion-safe:animate-console-log-in">
                    <span className="shrink-0 text-fd-muted-foreground/70">{entry.at}</span>
                    <span className="shrink-0 text-fd-primary">{entry.event}</span>
                    <span className="truncate text-fd-muted-foreground">{entry.detail}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </details>

        <span className="mx-0.5 h-5 w-px bg-fd-border/70" />

        <button
          type="button"
          data-testid="fullscreen-toggle"
          aria-pressed={fullscreen}
          title={fullscreen ? 'Leave fullscreen (Esc)' : 'Fill the window'}
          aria-label={fullscreen ? 'Leave fullscreen' : 'Fill the window'}
          className={`${ICON_BUTTON} aria-pressed:bg-fd-primary/10 aria-pressed:text-fd-primary`}
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
