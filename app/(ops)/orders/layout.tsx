import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireRoleGate } from '@/components/layout/RequireRoleGate';
import { getCurrentUser } from '@/lib/auth/verifySession';

interface OrdersLayoutProps {
  children: ReactNode;
}

export const dynamic = 'force-dynamic';

export default async function OrdersLayout({ children }: OrdersLayoutProps) {
  const user = await getCurrentUser();

  if (user && !['ADMIN', 'OPERATIONS'].includes(user.role)) {
    redirect('/forbidden');
  }

  return (
    <RequireRoleGate allowedRoles={['ADMIN', 'OPERATIONS']}>
      <div className="h-full">{children}</div>
    </RequireRoleGate>
  );
}
