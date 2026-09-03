'use client';

import { useNotebookLayout } from 'fumadocs-ui/layouts/notebook';

// `HomeLayout` already renders the navbar; this header only adds the mobile page-tree trigger.
export function DocsMobileNav() {
  const { slots } = useNotebookLayout();
  const SidebarTrigger = slots.sidebar.trigger;

  return (
    <header className="sticky top-(--fd-docs-row-1) z-10 flex h-12 items-center border-b bg-fd-background/80 px-4 backdrop-blur-sm [grid-area:header] md:hidden">
      <SidebarTrigger className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Menu
      </SidebarTrigger>
    </header>
  );
}
