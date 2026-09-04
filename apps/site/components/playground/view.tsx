'use client';

import {
  ReactGanttChart,
  type GanttFormatOverrides,
  type GanttHandle,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_ANCHOR, demoHolidays, demoTasks } from '@/components/demo/tasks';
import {
  CONTROLS,
  GROUPS,
  readSettings,
  SCALES,
  writeSettings,
  type Settings,
  type SelectValue,
} from '@/components/playground/controls';

// The fixture's own span, as dates. Read off `demoTasks` rather than the live `tasks` state, so
// dragging a bar out to the edge does not drag the bounds along with it.
const day = (iso: string) => iso.slice(0, 10);
const FIXTURE_START = day(
  demoTasks.reduce((first, task) => (task.startDate < first ? task.startDate : first), demoTasks[0].startDate)
);
const FIXTURE_END = day(
  demoTasks.reduce((last, task) => (task.endDate > last ? task.endDate : last), demoTasks[0].endDate)
);

// A fortnight past the tasks either side, so a pinned range reads apart from the auto-fit one.
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// One override per slot, on two scales - enough to see `formats` beat both the locale and the
// built-in labels. `d` arrives in UTC mode, so `.format()` needs no conversion.
const DEMO_FORMATS: GanttFormatOverrides = {
  day: {
    tick: (d) => d.format('D ddd'),
    header: (d) => d.format('MMMM YYYY').toUpperCase(),
    tooltip: (d) => d.format('YYYY/MM/DD HH:mm'),
  },
  // The week scale ticks in days and groups in weeks, so the override that reads as a week goes on
  // the header, not the tick.
  week: { header: (d) => `week of ${d.format('D MMM')}` },
};

// The console floats over the chart, so it follows the chart's own overlay language rather than
// the site's card: one step lifted off the chart background (#fafafa -> white, #09090b -> zinc
// 900), a hairline ring, and a shadow that does the separating. `dark:` here is fumadocs' `.dark`
// class, not the media query, so both follow the site's theme switch rather than the OS.
const HAIRLINE = 'border-black/[0.07] dark:border-white/[0.08]';

const SURFACE = `border bg-white dark:bg-[#18181b] ${HAIRLINE}`;

const PANEL = `${SURFACE} rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_44px_-14px_rgba(0,0,0,0.3)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.55),0_22px_52px_-16px_rgba(0,0,0,0.85)]`;

// Every interactive surface is the same tinted fill over the panel, so nothing needs its own
// colour: black at 2-7% in light, white at 3-9% in dark.
const FILL =
  'bg-black/[0.02] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08]';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-console-accent/45';

// The two icon controls at the strip's right end. Same 28px box and 8px radius as the buttons
// and the select beside them, so the row has one rhythm rather than a round object bolted on.
const ICON_ACTION =
  `grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-fd-muted-foreground transition-[background-color,color] duration-150 hover:bg-black/[0.06] hover:text-fd-foreground dark:hover:bg-white/[0.08] ${FOCUS}`;

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

// Split from its width so the strip can carry a narrower one: seven controls plus a 120px select
// wrap onto a third row at phone widths, and a scale key is a short word.
const SELECT_BASE =
  `h-7 cursor-pointer rounded-lg border px-2 text-[12px] text-fd-foreground transition-colors duration-150 ${HAIRLINE} ${FILL} ${FOCUS}`;

const SELECT = `${SELECT_BASE} w-[7.5rem]`;

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
  // Collapse is controlled outright: the chevrons write back through `onCollapsedChange`, which is
  // also what the two buttons below drive.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  // Tracked whether or not `controlledDetail` is on - off, it only feeds the stat row.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Both click callbacks land here: a double click reports last, over the two clicks under it.
  const [click, setClick] = useState('-');
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
    setCollapsed([]);
    setDetailId(null);
    setClick('-');
  };

  // Only rows that actually have children collapse.
  const parentIds = tasks
    .filter((task) => tasks.some((child) => child.parentId === task.id))
    .map((task) => task.id);

  // A fresh array every render would make the chart recompute its non-working days each time.
  const holidays = useMemo(
    () => (settings.holidays ? demoHolidays : undefined),
    [settings.holidays]
  );

  // Same reason as the holidays memo: a fresh array each render recomputes the non-working days.
  const workingWeekdays = useMemo(
    () => (settings.sixDayWeek ? [1, 2, 3, 4, 5, 6] : undefined),
    [settings.sixDayWeek]
  );

  const first = tasks.find((task) => task.parentId !== null) ?? tasks[0];

  // `scrollToToday()` no-ops off-range; both sides stay UTC `YYYY-MM-DD` so the string compare holds.
  const [rangeStart, rangeEnd] = range.split(' .. ');
  const today = new Date().toISOString().slice(0, 10);
  const todayInRange = Boolean(rangeEnd) && rangeStart <= today && today <= rangeEnd;
  const todayHint = todayInRange
    ? undefined
    : 'Today is outside the rendered range, so scrollToToday() is a documented no-op';

  // `readOnly` blocks creation too, so both copies of the button follow both switches.
  const canCreate = settings.allowTaskCreate && !settings.readOnly;
  const createHint = canCreate ? undefined : 'Turn task creation on first';

  return (
    // 3.5rem is HomeLayout's `h-14` navbar; z-50 clears Fumadocs' sticky nav, which sits at z-40.
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-fd-background'
          : 'relative flex h-[calc(100svh-3.5rem)] w-full flex-col overflow-hidden bg-fd-background'
      }
    >
      {/* The verbs a viewer presses many times a session, lifted out of the console: the two view
          methods that need no fixture id, task creation, and the scale. Every switch stays in the
          console - a strip of switches is just a second console. Painted on the chart's own ground
          rather than the site's card, which would read as a band above the chart's header. */}
      <div
        data-testid="toolbar"
        className={`relative flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b bg-[#fafafa] px-3 py-1.5 dark:bg-[#09090b] ${HAIRLINE}`}
      >
        <button
          type="button"
          className={ACTION}
          disabled={!todayInRange}
          title={todayHint}
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
          disabled={!canCreate}
          title={createHint}
          onClick={() => ref.current?.addTask()}
        >
          Add task
        </button>
        {/* Writes the same `settings.scale` the console's row does, so the two cannot disagree,
            and `onScaleChange` below carries a wheel or keyboard zoom back into both. */}
        <select
          data-testid="toolbar-scale"
          aria-label="Timeline scale"
          className={`${SELECT_BASE} ml-auto w-[4.75rem] sm:w-[7.5rem]`}
          value={settings.scale}
          onChange={(e) => update('scale', e.target.value as SelectValue)}
        >
          {SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>

        {/* Native <details>: controls stay in the DOM while closed, so a test clicks
            `console-toggle` first. Unpositioned, so the panel below anchors to the strip and lands
            on its right gutter rather than on this button's edge. */}
        <details data-testid="console" className="group/console">
          <summary
            data-testid="console-toggle"
            title="Console"
            aria-label="Toggle the console"
            className={`${ICON_ACTION} list-none group-open/console:bg-console-accent/10 group-open/console:text-console-accent [&::-webkit-details-marker]:hidden`}
          >
            <Icon>
              <path d="M4 6h9M17.5 6H20M4 12h2.5M11 12h9M4 18h9M17.5 18H20" />
              <circle cx="13" cy="6" r="2" />
              <circle cx="8.5" cy="12" r="2" />
              <circle cx="13" cy="18" r="2" />
            </Icon>
          </summary>

          <div
            data-testid="console-panel"
            // Hangs from the toggle at the strip's right edge, capped by what the window leaves
            // below it - the navbar, the strip and a gap at either end.
            // `overflow-clip`, not `hidden`: a hidden box is still a scroll container, and
            // focusing a row's sr-only checkbox scrolled the whole panel out of its own frame -
            // with no scrollbar to bring it back, the console read as an empty card. Clipping
            // leaves .console-scroll as the only scroller, which is the one the rows live in.
            className={`absolute right-3 top-[calc(100%+0.5rem)] z-[1000] flex max-h-[min(40rem,calc(100svh-8rem))] w-[21rem] max-w-[calc(100vw-2rem)] origin-top-right cursor-auto touch-auto select-text flex-col overflow-clip text-[12.5px] motion-safe:animate-console-in ${PANEL}`}
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
                  title={todayHint}
                  onClick={() => ref.current?.scrollToToday()}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={ACTION}
                  title={`scrollToDate('${DEMO_ANCHOR}')`}
                  onClick={() => ref.current?.scrollToDate(DEMO_ANCHOR)}
                >
                  Scroll to anchor
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
                {/* The one handle member with no gesture behind it: the scroll node itself,
                    for whatever the chart does not do for you. */}
                <button
                  type="button"
                  className={ACTION}
                  title="getScrollElement().scrollTo({ left: 0 })"
                  onClick={() =>
                    ref.current
                      ?.getScrollElement()
                      ?.scrollTo({ left: 0, behavior: 'smooth' })
                  }
                >
                  Scroll to start
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
                  disabled={!detailId}
                  onClick={() => ref.current?.closeDetail()}
                >
                  Close detail
                </button>
                <button
                  type="button"
                  className={ACTION}
                  // Collapsing needs summary rows, and there is nothing to collapse without them.
                  disabled={!settings.hierarchy || !parentIds.length}
                  title={settings.hierarchy ? undefined : 'Turn hierarchy on first'}
                  onClick={() => setCollapsed(parentIds)}
                >
                  Collapse all
                </button>
                <button
                  type="button"
                  className={ACTION}
                  disabled={!collapsed.length}
                  onClick={() => setCollapsed([])}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  className={ACTION}
                  disabled={!canCreate}
                  title={createHint}
                  onClick={() => ref.current?.addTask()}
                >
                  Add task
                </button>
                <button type="button" className={ACTION} onClick={reset}>
                  Reset data
                </button>
              </div>

              {/* The header already carries the task count and the scale, so this holds only what
                  it does not repeat - and reads as more rows rather than a second layout. */}
              <dl data-testid="stats" className="pb-3">
                {(
                  [
                    ['Selected', selected?.id ?? '-'],
                    ['Last click', click],
                    ['Detail', detailId ?? '-'],
                    ['Collapsed', collapsed.length ? collapsed.join(', ') : '-'],
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
                          className={`${ROW} relative cursor-pointer`}
                          title={control.hint}
                        >
                          <span>{control.label}</span>
                          {/* Transparent over the whole row rather than `sr-only`: the browser
                              reveals the box it focuses, and a 1px clipped one told it the row was
                              already on screen - tabbing landed on switches nobody could see. */}
                          <input
                            data-testid={control.key}
                            type="checkbox"
                            className="peer absolute inset-0 cursor-pointer opacity-0"
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
          className={`${ICON_ACTION} aria-pressed:bg-console-accent/10 aria-pressed:text-console-accent`}
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

      {/* The chart's own box, under the strip: the height row sizes it and the rest of the
          column is what "fill" fills. */}
      <div className="min-h-0 flex-1">
        <div
          className="bg-fd-card"
          style={{
            height: settings.chartHeight === 'fill' ? '100%' : `${settings.chartHeight}px`,
          }}
        >
          <ReactGanttChart
            ref={ref}
            // `initialScrollTo` is read once, at mount, so the row only means anything on a remount.
            key={settings.initialScrollTo}
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
            // A double click fires two clicks first, so the last write wins and reads "(double)".
            onTaskClick={(task) => setClick(task.id)}
            onTaskDoubleClick={(task) => setClick(`${task.id} (double)`)}
            selectable={settings.selectable}
            onRangeChange={(next) =>
              setRange(`${next.start.format('YYYY-MM-DD')} .. ${next.end.format('YYYY-MM-DD')}`)
            }
            // Each veto returns false, which is the documented "reject it" answer - the gesture runs,
            // the chart draws it, and then nothing is applied.
            onDependencyCreate={settings.vetoLinkCreate ? () => false : undefined}
            onDependencyDelete={settings.vetoLinkDelete ? () => false : undefined}
            onTaskMove={settings.vetoMove ? () => false : undefined}
            readOnly={settings.readOnly}
            // Each `allow*` beats `readOnly`, so only the off state is passed through.
            allowMove={settings.allowMove ? undefined : false}
            allowResize={settings.allowResize ? undefined : false}
            allowProgressChange={settings.allowProgressChange ? undefined : false}
            allowLinkCreate={settings.allowLinkCreate ? undefined : false}
            allowLinkDelete={settings.allowLinkDelete ? undefined : false}
            allowTaskCreate={settings.allowTaskCreate ? undefined : false}
            allowReorder={settings.reorder}
            minDate={settings.dateBounds ? FIXTURE_START : undefined}
            maxDate={settings.dateBounds ? FIXTURE_END : undefined}
            visibleStart={settings.visibleRange ? shift(FIXTURE_START, -14) : undefined}
            visibleEnd={settings.visibleRange ? shift(FIXTURE_END, 14) : undefined}
            height="100%"
            width="100%"
            showTaskList={settings.showTaskList}
            showRowNumbers={settings.showRowNumbers}
            collapsedIds={collapsed}
            onCollapsedChange={setCollapsed}
            showDetail={settings.showDetail}
            renderDetail={
              settings.customDetail
                ? ({ task, close, scale }) => (
                    <div className="flex flex-col gap-2 p-3 text-[12.5px]">
                      <strong className="text-[13px]">{task.name}</strong>
                      <span className="text-fd-muted-foreground">
                        {task.startDate} &rarr; {task.endDate} &middot; {scale}
                      </span>
                      <button type="button" className={ACTION} onClick={close}>
                        Close
                      </button>
                    </div>
                  )
                : undefined
            }
            detailTaskId={settings.controlledDetail ? detailId : undefined}
            onDetailChange={(task) => setDetailId(task?.id ?? null)}
            // Seeded from the console, so a remount lands on the scale the console is showing
            // instead of snapping back to the default.
            defaultScale={settings.scale}
            initialScrollTo={
              settings.initialScrollTo === 'none'
                ? undefined
                : settings.initialScrollTo === 'today'
                  ? 'today'
                  : DEMO_ANCHOR
            }
            // Keeps the console's `scale` row honest when ctrl+wheel or zoomToFit moves the scale.
            onScaleChange={(scale) => update('scale', scale)}
            // 'host' means "no prop" - the chart then inherits the site's color-scheme.
            theme={settings.theme === 'host' ? undefined : settings.theme}
            locale={settings.locale}
            firstDayOfWeek={Number(settings.firstDayOfWeek)}
            hierarchy={settings.hierarchy}
            showNonWorkingDays={settings.showNonWorkingDays}
            holidays={holidays}
            workingWeekdays={workingWeekdays}
            formats={settings.customFormats ? DEMO_FORMATS : undefined}
            workingCalendar={settings.workingCalendar}
            autoScrollOnDrag={settings.autoScrollOnDrag}
            showTooltip={settings.showTooltip}
            zoomOnWheel={settings.zoomOnWheel}
            infiniteScroll={settings.infiniteScroll}
          />
        </div>

      </div>
    </div>
  );
}