import { RootProvider } from 'fumadocs-ui/provider/next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { i18n, provider } from '@/lib/i18n';
// Upstream's dynamic subset: 92 unicode-range slices, so a page fetches only the glyph blocks it uses.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { Analytics } from '@vercel/analytics/next';

// Dev-only: a top-level import would ship the ~450 kB toolbar to prod, so it stays in this ternary.
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
  // Dotted paths skip the i18n proxy, so /favicon.ico arrives here as a lang
  if (!i18n.languages.some((language) => language === lang)) notFound();

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider i18n={provider(lang)}>{children}</RootProvider>
        <Analytics />
        <Agentation />
      </body>
    </html>
  );
}
