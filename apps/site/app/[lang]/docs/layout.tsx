import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { DocsMobileNav } from '@/components/docs-mobile-nav';
import { HomeContainer } from '@/components/home-container';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  const tree = source.pageTree[lang];
  if (!tree) notFound();
  const options = baseOptions(lang);

  return (
    <HomeLayout {...options} slots={{ container: HomeContainer }}>
      <DocsLayout
        tree={tree}
        {...options}
        nav={{ ...options.nav, mode: 'top' }}
        slots={{ header: DocsMobileNav }}
      >
        {children}
      </DocsLayout>
    </HomeLayout>
  );
}
