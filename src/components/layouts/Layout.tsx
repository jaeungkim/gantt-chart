import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-full">
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default Layout;
