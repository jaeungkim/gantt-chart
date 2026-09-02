import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE = 'https://gantt.jaeungkim.com';

/**
 * Site-wide defaults. `metadataBase` is what turns the relative OG image path into the
 * absolute URL crawlers require - without it Next emits a relative href and every social
 * preview comes back blank.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: '@jaeungkim/gantt-chart',
    template: '%s | @jaeungkim/gantt-chart',
  },
  description:
    'Virtualized React Gantt chart with six timeline scales, four dependency types, auto-scheduling, a working-day calendar, critical path, and keyboard and screen-reader support.',
  openGraph: {
    type: 'website',
    siteName: '@jaeungkim/gantt-chart',
    url: SITE,
    images: [{ url: '/og.png', width: 1200, height: 800 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
