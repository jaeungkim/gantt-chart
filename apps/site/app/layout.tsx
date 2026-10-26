import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE = 'https://gantt.jaeungkim.com';

// `metadataBase` makes the relative OG image paths absolute. Without it Next guesses the host:
// localhost, or a Vercel deployment URL.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: '@jaeungkim/gantt-chart',
    template: '%s | @jaeungkim/gantt-chart',
  },
  description:
    'Virtualized React Gantt chart with five timeline scales, four dependency types, and a working-day calendar.',
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
