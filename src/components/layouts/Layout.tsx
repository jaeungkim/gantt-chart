import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <>
      <main className="">{children}</main>
    </>
  );
}

export default Layout;
