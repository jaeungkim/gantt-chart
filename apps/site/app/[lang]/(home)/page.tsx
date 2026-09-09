import type { Metadata } from 'next';
import Link from 'next/link';
import { GanttDemo } from '@/components/demo/gantt-demo';

// The card order. Each href is also the key its copy is filed under, so a card can never
// end up pointing at a page other than the one its text describes.
const FEATURES = [
  '/docs/editing',
  '/docs/accessibility',
  '/docs/introduction',
  '/docs/task-list',
  '/docs/working-calendar',
  '/docs/theming',
] as const;

type FeatureHref = (typeof FEATURES)[number];

interface Copy {
  heroTitle: string;
  heroBody: string;
  getStarted: string;
  credentials: string;
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
    heroTitle: 'Bring interactive project planning to your React app.',
    heroBody:
      'Drag tasks, connect dependencies, and organize projects into nested timelines. Working calendars, keyboard editing, and light and dark themes come built in.',
    getStarted: 'Get started',
    credentials: 'Open source · MIT licensed · React 18 & 19 · TypeScript',
    tryTitle: 'Try it',
    tryBody:
      'The chart below is the published component. Drag a bar, pull an edge, or draw a link between two rows.',
    playground: 'Try the playground',
    docsTitle: 'Read the docs',
    docsBody: 'Every prop, guide and reference page, in English and Korean.',
    introduction: 'Introduction',
    props: 'GanttProps',
    features: {
      '/docs/editing': {
        title: 'Edit the plan directly',
        body: 'Drag to move, pull an edge to resize, drag the handle to set progress, draw an arrow to link two rows. Every gesture calls onTasksChange with the complete next array.',
      },
      '/docs/accessibility': {
        title: 'Keyboard and screen readers',
        body: 'An ARIA treegrid with a roving tabindex, arrow key navigation and keyboard edits announced in a status region. The accessibility page lists the gaps.',
      },
      '/docs/introduction': {
        title: 'Explore larger plans',
        body: 'Rows and timeline ticks are both windowed, so the chart renders what is on screen plus a small overscan.',
      },
      '/docs/task-list': {
        title: 'Move a whole project phase',
        body: 'Organize tasks into a collapsible hierarchy. Move a summary row and its children follow, keeping the phase together.',
      },
      '/docs/working-calendar': {
        title: 'Plan around working days',
        body: 'Set the working weekdays, and give each holiday a name and a colour. Turn on workingCalendar and a drop on a non-working day moves forward to the next working day.',
      },
      '/docs/theming': {
        title: 'Match your app',
        body: "Every colour reads from a CSS custom property. With no theme prop set, the chart follows the host page's color-scheme.",
      },
    },
  },
  ko: {
    heroTitle: 'React 앱에서 직접 편집하는 프로젝트 타임라인',
    heroBody:
      '작업을 끌어 옮기고 의존성을 연결하고 프로젝트를 계층형 타임라인으로 정리하세요. 근무일 달력과 키보드 편집, 라이트·다크 테마를 기본으로 제공해요.',
    getStarted: '시작하기',
    credentials: '오픈 소스 · MIT 라이선스 · React 18 & 19 · TypeScript',
    tryTitle: '직접 해보기',
    tryBody:
      '아래 차트는 배포된 실제 컴포넌트예요. 막대를 끌고 가장자리를 당기고 두 행 사이에 링크를 그어 보세요.',
    playground: '플레이그라운드 체험하기',
    docsTitle: '문서 읽기',
    docsBody: '모든 prop과 가이드, 레퍼런스 페이지를 영어와 한국어로 제공해요.',
    introduction: '소개',
    props: 'GanttProps',
    features: {
      '/docs/editing': {
        title: '타임라인에서 바로 편집',
        body: '막대를 끌어 옮기고 가장자리를 당겨 크기를 조절해요. 핸들을 끌면 진행률이 정해지고 화살표를 그으면 두 행이 연결돼요. 모든 제스처가 다음 tasks 배열 전체로 onTasksChange를 호출해요.',
      },
      '/docs/accessibility': {
        title: '키보드와 스크린 리더',
        body: '로빙 tabindex와 방향키 이동을 지원하는 ARIA treegrid예요. 키보드로 만든 편집은 role="status" 요소로 알려요. 남은 한계는 접근성 문서에 정리해 뒀어요.',
      },
      '/docs/introduction': {
        title: '더 큰 계획도 한눈에',
        body: '행과 타임라인 눈금을 모두 가상화해요. 화면에 보이는 범위와 오버스캔만큼만 렌더링해요.',
      },
      '/docs/task-list': {
        title: '프로젝트 단계를 한 번에 이동',
        body: '작업을 접고 펼칠 수 있는 계층으로 정리하세요. 요약 행을 옮기면 하위 작업이 함께 움직여요.',
      },
      '/docs/working-calendar': {
        title: '근무일에 맞춘 일정',
        body: '근무 요일을 정하고 휴일마다 이름과 색을 지정하세요. workingCalendar를 켜면 비근무일에 놓은 막대가 다음 근무일에 놓여요.',
      },
      '/docs/theming': {
        title: '앱에 어울리는 디자인',
        body: '모든 색을 CSS 커스텀 속성에서 읽어요. theme prop을 넘기지 않으면 호스트 페이지의 color-scheme을 그대로 따라요.',
      },
    },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const copy = COPY[lang === 'ko' ? 'ko' : 'en'];
  return { title: copy.heroTitle, description: copy.heroBody };
}

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
        <h1 className="text-balance break-keep text-4xl font-bold tracking-tight md:text-5xl">
          {copy.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance break-keep text-lg text-fd-muted-foreground">
          {copy.heroBody}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`${prefix}/playground`}
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {copy.playground}
          </Link>
          <Link
            href={`${prefix}/docs/quick-start`}
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            {copy.getStarted}
          </Link>
        </div>

        <p className="mt-5 text-sm text-fd-muted-foreground">{copy.credentials}</p>

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
