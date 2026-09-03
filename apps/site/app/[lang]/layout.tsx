import { RootProvider } from 'fumadocs-ui/provider/next';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { provider } from '@/lib/i18n';
import { pretendardKorean, pretendardLatin } from '../fonts/pretendard';
import { Analytics } from '@vercel/analytics/next';

// Dev-only annotation toolbar. The import must stay in the dead branch of this ternary: a top-level
// `import` keeps it in the module graph and Turbopack ships the 440 kB toolbar to production.
const Agentation =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('agentation').then((m) => m.Agentation))
    : () => null;

export default async function LangLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <html
      lang={lang}
      className={`${pretendardLatin.variable} ${pretendardKorean.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={provider(lang)}>{children}</RootProvider>
        <Analytics />
        <Agentation />
      </body>
    </html>
  );
}
