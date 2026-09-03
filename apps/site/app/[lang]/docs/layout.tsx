import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { DocsMobileNav } from '@/components/docs-mobile-nav';
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
  const options = baseOptions(lang);

  // HomeLayout wraps docs too so the navbar keeps one shape; the header slot adds the mobile nav.
  // ponytail: HomeLayout brings its own <main>, so docs pages now nest two of them (the landing
  // page already did); replace the docs container slot if an a11y audit ever flags the landmark.
  return (
    <HomeLayout {...options}>
      <DocsLayout
        tree={source.pageTree[lang]}
        {...options}
        nav={{ ...options.nav, mode: 'top' }}
        slots={{ header: DocsMobileNav }}
      >
        {children}
      </DocsLayout>
    </HomeLayout>
  );
}
