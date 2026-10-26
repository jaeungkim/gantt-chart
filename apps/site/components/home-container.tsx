'use client';

import type { ComponentProps } from 'react';

// HomeLayout's default container is a <main>; on docs pages DocsPage renders the one <main>.
// Keeps the id, which fumadocs' CSS targets through #nd-home-layout:has(...).
export function HomeContainer({ children }: ComponentProps<'main'>) {
  return (
    <div id="nd-home-layout" className="flex flex-1 flex-col [--fd-layout-width:1400px]">
      {children}
    </div>
  );
}
