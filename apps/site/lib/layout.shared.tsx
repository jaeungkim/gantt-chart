import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// One navbar for the whole site: the landing page and every docs page spread these same options.
// The two internal links are the only translatable strings here; npm and the GitHub icon are names.
const NAV = {
  en: { playground: 'Playground', docs: 'Documentation' },
  ko: { playground: '플레이그라운드', docs: '문서' },
};

export function baseOptions(locale: string): BaseLayoutProps {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const text = NAV[locale === 'ko' ? 'ko' : 'en'];

  return {
    i18n: true,
    nav: {
      title: <span className="font-semibold">@jaeungkim/gantt-chart</span>,
      url: prefix || '/',
    },
    links: [
      { text: text.playground, url: `${prefix}/playground`, active: 'nested-url' },
      { text: text.docs, url: `${prefix}/docs`, active: 'nested-url' },
      {
        text: 'npm',
        url: 'https://www.npmjs.com/package/@jaeungkim/gantt-chart',
        external: true,
      },
    ],
    githubUrl: 'https://github.com/jaeungkim/gantt-chart',
  };
}
