'use client';

import dynamic from 'next/dynamic';

// `view.tsx` seeds state from the query string; `ssr: false` is only legal from a client component.
const PlaygroundView = dynamic(
  () => import('@/components/playground/view').then((m) => m.PlaygroundView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center text-sm text-fd-muted-foreground">
        Loading playground…
      </div>
    ),
  }
);

export function Playground() {
  return <PlaygroundView />;
}
