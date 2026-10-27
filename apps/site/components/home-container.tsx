'use client';

import type { ComponentProps } from 'react';

export function HomeContainer({ children }: ComponentProps<'main'>) {
  return (
    <div id="nd-home-layout" className="flex flex-1 flex-col [--fd-layout-width:1400px]">
      {children}
    </div>
  );
}
