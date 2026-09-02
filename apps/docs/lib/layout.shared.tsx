import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * One navbar for the whole site. The landing page and every docs page spread these same
 * options, so the header does not change shape as you move between them.
 */
export function baseOptions(locale: string): BaseLayoutProps {
  const prefix = locale === 'en' ? '' : `/${locale}`;

  return {
    i18n: true,
    nav: {
      title: <span className="font-semibold">@jaeungkim/gantt-chart</span>,
      // The wordmark returns to the landing page, not into the docs.
      url: prefix || '/',
    },
    links: [
      { text: 'Playground', url: `${prefix}/#playground`, active: 'none' },
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
