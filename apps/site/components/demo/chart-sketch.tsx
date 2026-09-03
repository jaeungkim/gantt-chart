import type { CSSProperties } from 'react';

// Drawn from a spec, coloured with the chart's own custom properties so it tracks both themes.
type BarKind = 'bar' | 'summary' | 'baseline';

interface Bar {
  // Both ends are a percentage of the frame's full width.
  from: number;
  to: number;
  kind?: BarKind;
  label?: string;
  // Draws a finish-to-start connector from the preceding bar.
  arrow?: boolean;
}

interface Row {
  name: string;
  // Indent steps in the task list, 0 for a top-level row.
  depth?: number;
  kind?: 'group' | 'summary';
  // The `+n` chip shown when a row carries more than one task.
  chip?: string;
  // 1-based index into `notes`.
  note?: number;
  bars?: Bar[];
}

interface SketchSpec {
  months: { label: string; width: number; note?: number }[];
  ticks: { label: string; at: number }[];
  ticksNote?: number;
  rows: Row[];
  paneLabel: string;
  caption: string;
  // Legend entries, in badge order.
  notes: string[];
}

const BAR_STYLE: Record<BarKind, CSSProperties> = {
  bar: { background: 'var(--gantt-bar-bg, #4f7cff)', height: 14, borderRadius: 4 },
  summary: { background: 'var(--gantt-summary-bg, #64748b)', height: 10, borderRadius: 3 },
  baseline: { background: 'var(--gantt-baseline-bg, #94a3b8)', height: 5, borderRadius: 2 },
};

// Legend copy carries only `code spans`, so a split beats pulling in a parser.
function richText(text: string) {
  return text.split('`').map((part, i) =>
    i % 2 === 1 ? (
      <code
        key={`${part}-${i}`}
        className="rounded border border-fd-border bg-fd-muted px-1 text-[0.75rem] text-fd-foreground"
      >
        {part}
      </code>
    ) : (
      part
    )
  );
}

function Badge({ n, tone = 'solid' }: { n: number; tone?: 'solid' | 'quiet' }) {
  return (
    <span
      className={`inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-medium tabular-nums ${
        tone === 'solid'
          ? 'bg-fd-primary text-fd-primary-foreground'
          : 'bg-fd-muted text-fd-muted-foreground ring-1 ring-fd-border ring-inset'
      }`}
      aria-hidden
    >
      {n}
    </span>
  );
}

function SketchFrame({ spec }: { spec: SketchSpec }) {
  return (
    <figure className="not-prose my-6">
      <div className="overflow-hidden rounded-lg border border-fd-border bg-fd-card">
        <div className="grid grid-cols-[minmax(7.5rem,11rem)_1fr_2.25rem] text-[0.75rem] leading-none">
          <div className="row-span-2 flex items-end border-r border-b border-fd-border px-3 py-2 font-medium text-fd-muted-foreground">
            {spec.paneLabel}
          </div>
          <div className="flex border-b border-fd-border">
            {spec.months.map((month) => (
              <div
                key={month.label}
                style={{ width: `${month.width}%` }}
                className="border-r border-fd-border/60 px-2 py-1.5 font-medium text-fd-foreground last:border-r-0"
              >
                {month.label}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center border-b border-l border-fd-border">
            {spec.months.map((month) =>
              month.note ? <Badge key={month.label} n={month.note} /> : null
            )}
          </div>

          <div className="relative h-7 border-b border-fd-border text-fd-muted-foreground">
            {spec.ticks.map((tick) => (
              <span
                key={tick.label}
                style={{ left: `${tick.at}%` }}
                className="absolute top-1/2 -translate-y-1/2 px-2 tabular-nums"
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center border-b border-l border-fd-border">
            {spec.ticksNote ? <Badge n={spec.ticksNote} /> : null}
          </div>

          {spec.rows.map((row) => (
            <SketchRow key={row.name} row={row} />
          ))}
        </div>
      </div>

      <figcaption className="sr-only">{spec.caption}</figcaption>
      <ol className="mt-3 grid gap-1.5 text-[0.8125rem] text-fd-muted-foreground sm:grid-cols-2">
        {spec.notes.map((note, i) => (
          <li key={note} className="flex items-start gap-2 leading-relaxed">
            <span className="mt-0.5">
              <Badge n={i + 1} tone="quiet" />
            </span>
            <span>{richText(note)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function SketchRow({ row }: { row: Row }) {
  const isGroup = row.kind === 'group';
  const bars = row.bars ?? [];

  return (
    <>
      <div
        className={`flex items-center gap-1.5 border-r border-b border-fd-border/60 py-2 pr-2 ${
          isGroup ? 'bg-fd-muted font-medium text-fd-foreground' : 'text-fd-muted-foreground'
        }`}
        style={{ paddingLeft: `${0.75 + (row.depth ?? 0) * 0.875}rem` }}
      >
        {isGroup || row.kind === 'summary' ? (
          <span className="text-[0.75rem] leading-none text-fd-muted-foreground">▾</span>
        ) : null}
        <span className="truncate">{row.name}</span>
        {row.chip ? (
          <span className="ml-auto rounded bg-fd-muted px-1 py-px text-[0.625rem] text-fd-muted-foreground tabular-nums">
            {row.chip}
          </span>
        ) : null}
      </div>

      <div
        className={`relative border-b border-fd-border/60 ${isGroup ? 'bg-fd-muted' : ''}`}
        style={{ minHeight: '2.25rem' }}
      >
        {bars.map((bar, i) => {
          const kind = bar.kind ?? 'bar';
          // Baselines sit under the live bar, so they hug the row's bottom while the rest centres.
          const vertical: CSSProperties =
            kind === 'baseline'
              ? { bottom: 4 }
              : { top: '50%', transform: 'translateY(-50%)' };
          return (
            <div
              key={`${bar.from}-${kind}-${i}`}
              style={{
                position: 'absolute',
                left: `${bar.from}%`,
                width: `${bar.to - bar.from}%`,
                ...BAR_STYLE[kind],
                ...vertical,
              }}
              className="flex items-center overflow-hidden px-1.5"
            >
              {bar.label ? (
                <span
                  className="truncate text-[0.625rem] leading-none"
                  style={{ color: 'var(--gantt-bar-text, #fff)' }}
                >
                  {bar.label}
                </span>
              ) : null}
            </div>
          );
        })}
        {bars.map((bar, i) =>
          bar.arrow && i > 0 ? (
            <div
              key={`arrow-${bar.from}`}
              style={{
                position: 'absolute',
                left: `${bars[i - 1].to}%`,
                width: `${bar.from - bars[i - 1].to}%`,
                top: '50%',
                color: 'var(--gantt-arrow, #94a3b8)',
              }}
              className="flex -translate-y-1/2 items-center"
            >
              <span className="h-px flex-1 bg-current" />
              <span className="-ml-px text-[0.5rem] leading-none">▶</span>
            </div>
          ) : null
        )}
      </div>

      <div className="flex items-center justify-center border-b border-l border-fd-border/60">
        {row.note ? <Badge n={row.note} /> : null}
      </div>
    </>
  );
}

// Percentages of days off the frame's first day; the spans match each page's own code sample.
const day42 = (d: number) => (d / 42) * 100;
const day19 = (d: number) => (d / 19) * 100;

type Lang = 'en' | 'ko';

const PRESETS = {
  anatomy: (lang: Lang): SketchSpec => ({
    paneLabel: lang === 'ko' ? '작업 목록' : 'task list',
    caption:
      lang === 'ko'
        ? '차트 정지 화면이에요. 왼쪽은 작업 목록 패널, 오른쪽은 타임라인이고, 요약 행 하나와 두 작업·베이스라인이 실린 레인 행 하나, 보통 행 하나가 있어요.'
        : 'A still of the chart: the task list pane on the left, the timeline on the right, holding a summary row, a lane row carrying two tasks and a baseline, and an ordinary row.',
    months: [
      { label: 'March 2026', width: day42(30), note: 1 },
      { label: 'April 2026', width: day42(12) },
    ],
    ticksNote: 2,
    ticks: [0, 7, 14, 21, 28, 35].map((d) => ({
      label: d < 30 ? String(2 + d) : String(d - 29),
      at: day42(d),
    })),
    rows: [
      {
        name: 'Phase 1',
        kind: 'summary',
        note: 3,
        bars: [{ from: day42(0), to: day42(19), kind: 'summary' }],
      },
      {
        name: 'Design',
        depth: 1,
        chip: '+1',
        note: 4,
        bars: [
          { from: day42(0), to: day42(5), label: 'Design' },
          { from: day42(7), to: day42(19), label: 'Build', arrow: true },
          { from: day42(7), to: day42(17), kind: 'baseline' },
        ],
      },
      {
        name: 'Ship',
        note: 5,
        bars: [{ from: day42(21), to: day42(26), label: 'Ship' }],
      },
    ],
    notes:
      lang === 'ko'
        ? [
            '위쪽 헤더 행이에요. 화면에 들어오는 기간을 스케일 한 단위씩 묶어서 보여줘요.',
            '눈금 행이에요. 눈금 하나가 덮는 기간은 스케일이 정하고, 폭이 모자라면 라벨을 솎아내요.',
            '요약 행이에요. `hierarchy`가 켜져 있고 `parentId`로 자식이 달린 작업이고, 날짜는 자식에게서 와요.',
            '레인 행이에요. `lane` 값이 같고 기간이 겹치지 않는 두 작업이 한 행에 실렸어요. `Build` 아래 얇은 막대가 베이스라인이에요.',
            '보통 행이에요. 작업 하나가 막대 하나로 그려져요.',
          ]
        : [
            'Top header row: the visible span, bucketed one unit of the scale at a time.',
            'Tick row: how much time one tick covers is the scale, and labels thin out when the width runs short.',
            'Summary row: a task with children under `parentId`, with `hierarchy` on. Its dates come from the children.',
            'Lane row: two tasks sharing a `lane` and not overlapping in time, packed onto one row. The thin bar under `Build` is its baseline.',
            'Ordinary row: one task, one bar.',
          ],
  }),

  grouping: (lang: Lang): SketchSpec => ({
    paneLabel: lang === 'ko' ? '작업 목록' : 'task list',
    caption:
      lang === 'ko'
        ? 'team으로 그룹을 묶은 차트 정지 화면이에요. 그룹 헤더 행 3개, 두 작업이 실린 레인 행 1개, 보통 행 3개가 있어요.'
        : 'A still of the chart grouped by team: three group header rows, a lane row carrying two tasks, and three ordinary rows.',
    months: [{ label: 'March 2026', width: 100 }],
    ticks: [0, 7, 14].map((d) => ({ label: String(2 + d), at: day19(d) })),
    rows: [
      { name: 'Design', kind: 'group', chip: '3', note: 1 },
      {
        name: 'Spec',
        depth: 1,
        chip: '+1',
        note: 2,
        bars: [
          { from: day19(0), to: day19(5), label: 'Spec' },
          { from: day19(7), to: day19(12), label: 'Wires' },
        ],
      },
      {
        name: 'Review',
        depth: 1,
        bars: [{ from: day19(2), to: day19(4), label: 'Rev' }],
      },
      { name: 'Backend', kind: 'group', chip: '1' },
      {
        name: 'API',
        depth: 1,
        bars: [{ from: day19(0), to: day19(12), label: 'API' }],
      },
      { name: 'Ungrouped', kind: 'group', chip: '1', note: 3 },
      {
        name: 'Cleanup',
        depth: 1,
        bars: [{ from: day19(14), to: day19(17), label: 'Cleanup' }],
      },
    ],
    notes:
      lang === 'ko'
        ? [
            '그룹 헤더 행이에요. `groupBy` 값 하나마다 한 행이고, 자기 작업은 갖지 않아요.',
            '레인 행이에요. `Spec`과 `Wires`가 같은 `lane`을 쓰고 겹치지 않아서 한 행에 묶였어요.',
            '`null`, `undefined`, 빈 문자열만 Ungrouped 밴드로 가요.',
          ]
        : [
            'Group header row: one per `groupBy` value, owning no task of its own.',
            'Lane row: `Spec` and `Wires` share a `lane` and do not overlap, so they pack onto one row.',
            'Only `null`, `undefined` and the empty string land in the Ungrouped band.',
          ],
  }),
} satisfies Record<string, (lang: Lang) => SketchSpec>;

type ChartSketchPreset = keyof typeof PRESETS;

export function ChartSketch({
  preset,
  lang = 'en',
}: {
  preset: ChartSketchPreset;
  lang?: Lang;
}) {
  return <SketchFrame spec={PRESETS[preset](lang)} />;
}
