import type { Metadata } from 'next';
import Link from 'next/link';
import { GanttDemo } from '@/components/demo/gantt-demo';

export const metadata: Metadata = {
  title: 'A Gantt chart for React that you can actually edit',
  description:
    'Virtualized React Gantt chart with five timeline scales, four dependency types, a working-day calendar, and keyboard and screen-reader support.',
};

// The card order. Each href is also the key its copy is filed under, so a card can never
// end up pointing at a page other than the one its text describes.
const FEATURES = [
  '/docs/editing',
  '/docs/working-calendar',
  '/docs/headless-core',
  '/docs/introduction',
  '/docs/accessibility',
  '/docs/theming',
] as const;

type FeatureHref = (typeof FEATURES)[number];

interface Copy {
  heroTitle: string;
  heroBody: string;
  getStarted: string;
  tryTitle: string;
  tryBody: string;
  playground: string;
  docsTitle: string;
  docsBody: string;
  introduction: string;
  props: string;
  features: Record<FeatureHref, { title: string; body: string }>;
}

// The landing page is a translation pair like every docs page: en and ko move together.
const COPY: Record<'en' | 'ko', Copy> = {
  en: {
    heroTitle: 'A Gantt chart for React that you can actually edit',
    heroBody:
      'Virtualized rows, four dependency types and a working-day calendar — with a date core that runs without a DOM.',
    getStarted: 'Get started',
    tryTitle: 'Try it',
    tryBody:
      'The real component, not a screenshot. Drag a bar, pull an edge, draw a link.',
    playground: 'Open the playground',
    docsTitle: 'Read the docs',
    docsBody: 'Every prop, guide and reference page, in English and Korean.',
    introduction: 'Introduction',
    props: 'GanttProps',
    features: {
      '/docs/editing': {
        title: 'Editable by default',
        body: 'Drag to move, pull an edge to resize, drag a handle to set progress, draw an arrow to link two rows. Every gesture hands you the new task array.',
      },
      '/docs/working-calendar': {
        title: 'Working-day dates',
        body: 'Set your own work week, and name a holiday and give it a colour. With the working calendar on, a drop lands on the next working day instead of a Saturday.',
      },
      '/docs/headless-core': {
        title: 'Headless core',
        body: 'createWorkingCalendar and the task-tree helpers import no React and touch no DOM, so a server or a worker can run them.',
      },
      '/docs/introduction': {
        title: 'Virtualized',
        body: 'Rows and the timeline are both windowed, so the row count stops mattering long before your data does.',
      },
      '/docs/accessibility': {
        title: 'Keyboard and screen readers',
        body: 'An ARIA treegrid with roving focus, arrow-key navigation and announced edits. The gaps that remain are written down, not hidden.',
      },
      '/docs/theming': {
        title: 'Yours to style',
        body: "Every colour reads from a CSS custom property, and with no theme prop set the chart follows the host page's color-scheme, so it inherits your theme instead of fighting your tokens.",
      },
    },
  },
  ko: {
    heroTitle: '진짜로 편집할 수 있는 React 간트 차트',
    heroBody:
      '가상화된 행, 네 가지 의존성 타입, 근무일 달력 — 날짜 코어는 DOM 없이도 돌아가요.',
    getStarted: '시작하기',
    tryTitle: '직접 해보기',
    tryBody:
      '스크린샷이 아니라 실제 컴포넌트예요. 막대를 끌고, 가장자리를 당기고, 링크를 그어 보세요.',
    playground: '플레이그라운드 열기',
    docsTitle: '문서 읽기',
    docsBody: '모든 prop과 가이드, 레퍼런스 페이지를 영어와 한국어로 제공해요.',
    introduction: '소개',
    props: 'GanttProps',
    features: {
      '/docs/editing': {
        title: '기본부터 편집 가능',
        body: '막대를 끌어 옮기고, 가장자리를 당겨 길이를 바꾸고, 핸들을 끌어 진행률을 정하고, 화살표를 그어 두 행을 이어요. 모든 제스처가 새 task 배열을 넘겨줘요.',
      },
      '/docs/working-calendar': {
        title: '근무일 기준 날짜',
        body: '근무 요일을 직접 정하고, 휴일에 이름과 색을 줄 수 있어요. 근무일 달력을 켜면 토요일 대신 다음 근무일에 놓여요.',
      },
      '/docs/headless-core': {
        title: '헤드리스 코어',
        body: 'createWorkingCalendar와 작업 트리 헬퍼는 React를 가져오지 않고 DOM도 건드리지 않아서, 서버나 워커에서도 돌아가요.',
      },
      '/docs/introduction': {
        title: '가상화',
        body: '행과 타임라인이 모두 보이는 만큼만 렌더링돼서, 데이터가 커지기 한참 전부터 행 개수는 문제가 되지 않아요.',
      },
      '/docs/accessibility': {
        title: '키보드와 스크린 리더',
        body: '로빙 포커스와 화살표 키 이동, 편집 알림을 갖춘 ARIA treegrid예요. 남아 있는 빈틈은 숨기지 않고 문서에 적어 뒀어요.',
      },
      '/docs/theming': {
        title: '스타일은 마음대로',
        body: '모든 색을 CSS 커스텀 속성에서 읽고, theme prop을 주지 않으면 호스트 페이지의 color-scheme을 따라가요. 그래서 토큰과 싸우지 않고 테마를 그대로 물려받아요.',
      },
    },
  },
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const prefix = lang === 'en' ? '' : `/${lang}`;
  const copy = COPY[lang === 'ko' ? 'ko' : 'en'];

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-7xl px-4 pt-16 pb-10 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          {copy.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-fd-muted-foreground">
          {copy.heroBody}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/docs/quick-start`}
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            {copy.getStarted}
          </Link>
        </div>

        <code className="mt-7 inline-block rounded-lg border border-fd-border bg-fd-card px-4 py-2 font-mono text-sm">
          pnpm add @jaeungkim/gantt-chart
        </code>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pt-4 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-xl flex-col gap-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">{copy.tryTitle}</h2>
            <p className="text-fd-muted-foreground">{copy.tryBody}</p>
          </div>
          <Link
            href={`${prefix}/playground`}
            className="rounded-lg border border-fd-border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {copy.playground}
          </Link>
        </div>
        <GanttDemo preset="showcase" height={520} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((href) => (
            <Link
              key={href}
              href={`${prefix}${href}`}
              className="rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
            >
              <h3 className="font-semibold">{copy.features[href].title}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                {copy.features[href].body}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-24 text-center">
        <h2 className="text-2xl font-semibold">{copy.docsTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-fd-muted-foreground">{copy.docsBody}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/docs/introduction`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {copy.introduction}
          </Link>
          <Link
            href={`${prefix}/docs/ref/props`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {copy.props}
          </Link>
        </div>
      </section>
    </main>
  );
}
