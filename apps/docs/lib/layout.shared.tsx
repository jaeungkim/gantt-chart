import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n: true,
    nav: {
      title: (
        <>
          <span className="font-semibold">@jaeungkim/gantt-chart</span>
        </>
      ),
      url: locale === 'en' ? '/docs' : `/${locale}/docs`,
    },
    githubUrl: 'https://github.com/jaeungkim/gantt-chart',
  };
}
