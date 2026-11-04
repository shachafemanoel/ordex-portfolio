import type { ReactNode } from 'react';

interface CustomersLayoutProps {
  children: ReactNode;
}

export const dynamic = 'force-dynamic';

export default function CustomersLayout({ children }: CustomersLayoutProps) {
  return children;
}
