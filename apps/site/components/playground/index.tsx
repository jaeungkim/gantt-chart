'use client';

import dynamic from 'next/dynamic';

// `view.tsx` seeds its state from the query string, which a server render cannot see; `ssr: false`
// is only legal from a client component, which is why this boundary is its own file.
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
