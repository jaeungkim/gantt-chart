import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <>
      <main className="h-dvh">{children}</main>
    </>
  );
}

export default Layout;
