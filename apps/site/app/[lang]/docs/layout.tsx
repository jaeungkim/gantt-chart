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
  // Next renders this layout alongside [lang]/layout, so an unknown lang reaches it too
  const tree = source.pageTree[lang];
  if (!tree) notFound();
  const options = baseOptions(lang);

  // HomeLayout wraps docs too so the navbar keeps one shape; the header slot adds the mobile nav.
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
