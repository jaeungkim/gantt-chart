import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// One navbar for the whole site: the landing page and every docs page spread these same options.
export function baseOptions(locale: string): BaseLayoutProps {
  const prefix = locale === 'en' ? '' : `/${locale}`;

  return {
    i18n: true,
    nav: {
      title: <span className="font-semibold">@jaeungkim/gantt-chart</span>,
      url: prefix || '/',
    },
    links: [
      { text: 'Playground', url: `${prefix}/playground`, active: 'nested-url' },
      { text: 'Documentation', url: `${prefix}/docs`, active: 'nested-url' },
      {
        text: 'npm',
        url: 'https://www.npmjs.com/package/@jaeungkim/gantt-chart',
        external: true,
      },
    ],
    githubUrl: 'https://github.com/jaeungkim/gantt-chart',
  };
}
