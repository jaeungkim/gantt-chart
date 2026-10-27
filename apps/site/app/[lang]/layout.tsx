import { RootProvider } from 'fumadocs-ui/provider/next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { i18n, provider } from '@/lib/i18n';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { Analytics } from '@vercel/analytics/next';

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
