'use client';

import {
  ReactGanttChart,
  type GanttHandle,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const ACTION =
  'rounded-lg border border-fd-border px-2.5 py-1.5 text-[13px] text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fd-muted-foreground';

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider text-fd-muted-foreground';

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

  // Ours, not the browser's. requestFullscreen took over the whole screen, hid the navbar and
  // left Esc as the only way out - on a page whose point is that you can keep reading around it.
  // This just pins the root over the viewport, so the exit control stays visible and Esc is a
  // convenience rather than the escape hatch.
  useEffect(() => {
    if (!fullscreen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', close);
    // The page behind must not scroll while the overlay is up.
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

  // `scrollToToday()` silently no-ops when today is off the rendered range, so the button is
  // disabled with a reason. Both sides must stay UTC `YYYY-MM-DD` for the string compare to hold.
  const [rangeStart, rangeEnd] = range.split(' .. ');
  const today = new Date().toISOString().slice(0, 10);
  const todayInRange = Boolean(rangeEnd) && rangeStart <= today && today <= rangeEnd;

  return (
    // 3.5rem is HomeLayout's `h-14` navbar. Fullscreen drops the navbar allowance and lifts the
    // root over it - z-50 clears Fumadocs' sticky nav, which sits at z-40.
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

      {/* z-index clears every chart layer and stays under Agentation's 100000 */}
      <button
        type="button"
        data-testid="fullscreen-toggle"
        aria-pressed={fullscreen}
        title={fullscreen ? 'Leave fullscreen (Esc)' : 'Fill the window'}
        className="absolute bottom-16 left-4 z-[1000] flex items-center gap-2 rounded-full border border-fd-border bg-fd-card py-2 pl-3 pr-4 text-[13px] font-medium text-fd-foreground shadow-lg transition-colors hover:bg-fd-accent"
        onClick={() => setFullscreen((current) => !current)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          {fullscreen ? (
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          ) : (
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          )}
        </svg>
        {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      </button>
      {/* A native <details>: the controls are in the DOM but hidden while closed, so a test must
          click `console-toggle` before touching any control testid. */}
      <details data-testid="console" className="fixed bottom-4 left-4 z-[1000]">
        <summary
          data-testid="console-toggle"
          title="Console"
          aria-label="Toggle the console"
          className="grid size-10 cursor-pointer list-none place-items-center rounded-full bg-fd-primary text-xl text-fd-primary-foreground shadow-lg [&::-webkit-details-marker]:hidden"
        >
          &#9881;
        </summary>

        <div // `[&>*]:shrink-0` - a scrolling flex column would otherwise squash the stats grid.
          className="absolute bottom-12 left-0 flex max-h-[calc(100svh-80px)] w-[300px] max-w-[calc(100vw-32px)] flex-col gap-4 overflow-y-auto rounded-xl border border-fd-border bg-fd-card p-4 text-[13px] shadow-xl [&>*]:shrink-0">

          <div data-testid="actions" className="flex flex-wrap items-center gap-2">
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

          <dl
            data-testid="stats"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-fd-border bg-fd-border"
          >
            {[
              ['Tasks', String(tasks.length)],
              ['Scale', settings.scale],
              ['Selected', selected?.id ?? '-'],
              ['Rendered range', range],
            ].map(([term, value]) => (
              <div key={term} className="bg-fd-card px-2.5 py-1.5">
                <dt className={HEADING}>{term}</dt>
                <dd className="mt-0.5 truncate font-mono text-[12px] text-fd-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-2.5">
              <h3 className={HEADING}>{group}</h3>
              {CONTROLS.filter((control) => control.group === group).map((control) =>
                control.type === 'boolean' ? (
                  <label key={control.key} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      data-testid={control.key}
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 accent-fd-primary"
                      checked={settings[control.key]}
                      onChange={(e) => update(control.key, e.target.checked)}
                    />
                    <span className="flex flex-col">
                      <span className="text-fd-foreground">{control.label}</span>
                      <span className="text-[11px] leading-4 text-fd-muted-foreground">
                        {control.hint}
                      </span>
                    </span>
                  </label>
                ) : (
                  <label key={control.key} className="flex flex-col gap-1">
                    <span className="text-fd-foreground">{control.label}</span>
                    <span className="text-[11px] leading-4 text-fd-muted-foreground">
                      {control.hint}
                    </span>
                    <select
                      data-testid={control.key}
                      className="mt-0.5 h-8 cursor-pointer rounded-lg border border-fd-border bg-fd-background px-2 text-fd-foreground outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
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
            </section>
          ))}

          <section className="flex flex-col gap-2">
            <h3 className={`${HEADING} flex items-center justify-between`}>
              Event log
              <button
                type="button"
                className="text-[11px] normal-case tracking-normal underline underline-offset-2 hover:text-fd-foreground"
                onClick={() => setLog([])}
              >
                Clear
              </button>
            </h3>
            <ol
              data-testid="event-log"
              className="max-h-40 overflow-y-auto rounded-lg border border-fd-border p-2 font-mono text-[11.5px] leading-5"
            >
              {log.length === 0 && (
                <li className="px-1 py-1 font-sans text-fd-muted-foreground">
                  Every callback the chart fires shows up here. Drag a bar, draw a link, click a
                  row.
                </li>
              )}
              {log.map((entry) => (
                <li key={entry.id} className="flex gap-2 px-1">
                  <span className="shrink-0 text-fd-muted-foreground">{entry.at}</span>
                  <span className="shrink-0 text-fd-foreground">{entry.event}</span>
                  <span className="truncate text-fd-muted-foreground">{entry.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </details>
    </div>
  );
}
