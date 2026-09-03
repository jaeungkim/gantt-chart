import type { Metadata } from 'next';
import Link from 'next/link';
import { GanttDemo } from '@/components/demo/gantt-demo';

export const metadata: Metadata = {
  title: 'A Gantt chart for React that you can actually edit',
  description:
    'Virtualized React Gantt chart with six timeline scales, four dependency types, a working-day calendar, and keyboard and screen-reader support.',
};

const FEATURES = [
  {
    title: 'Editable by default',
    body: 'Drag to move, pull an edge to resize, drag a handle to set progress, draw an arrow to link two rows. Every gesture hands you the new task array.',
  },
  {
    title: 'Working-day dates',
    body: 'A working-day calendar that skips weekends and holidays, and baselines to show the plan against the plan you had.',
  },
  {
    title: 'Headless core',
    body: 'createWorkingCalendar and the task-tree helpers import no React and touch no DOM, so a server or a worker can run them.',
  },
  {
    title: 'Virtualized',
    body: 'Rows and the timeline are both windowed, so the row count stops mattering long before your data does.',
  },
  {
    title: 'Keyboard and screen readers',
    body: 'An ARIA treegrid with roving focus, arrow-key navigation and announced edits. The gaps that remain are written down, not hidden.',
  },
  {
    title: 'Yours to style',
    body: 'Every colour reads from a CSS custom property, so the chart follows your theme without a theme prop and without fighting your tokens.',
  },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const prefix = lang === 'en' ? '' : `/${lang}`;

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          A Gantt chart for React that you can actually edit
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-fd-muted-foreground">
          Virtualized rows, four dependency types and a working-day calendar — with a
          date core that runs without a DOM.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/docs/quick-start`}
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href={`${prefix}/playground`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Playground
          </Link>
        </div>

        <code className="mt-7 inline-block rounded-lg border border-fd-border bg-fd-card px-4 py-2 font-mono text-sm">
          pnpm add @jaeungkim/gantt-chart
        </code>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-4 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-xl flex-col gap-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">Try it</h2>
            <p className="text-fd-muted-foreground">
              The real component, not a screenshot. Drag a bar, pull an edge, draw a link.
            </p>
          </div>
          <Link
            href={`${prefix}/playground`}
            className="rounded-lg border border-fd-border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Open the playground
          </Link>
        </div>
        <GanttDemo preset="hierarchy" height={480} />
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-fd-border bg-fd-card p-5"
            >
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 text-center">
        <h2 className="text-2xl font-semibold">Read the docs</h2>
        <p className="mx-auto mt-2 max-w-xl text-fd-muted-foreground">
          Every prop, guide and reference page, in English and Korean.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/docs/introduction`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Introduction
          </Link>
          <Link
            href={`${prefix}/docs/ref/props`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Prop reference
          </Link>
        </div>
      </section>
    </main>
  );
}
