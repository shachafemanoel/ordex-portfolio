import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireRoleGate } from '@/components/layout/RequireRoleGate';
import { getCurrentUser } from '@/lib/auth/verifySession';

interface DeliveriesLayoutProps {
  children: ReactNode;
}

export const dynamic = 'force-dynamic';

export default async function DeliveriesLayout({ children }: DeliveriesLayoutProps) {
  const user = await getCurrentUser();

  if (user && !['ADMIN', 'OPERATIONS', 'INSTALLER'].includes(user.role)) {
    redirect('/forbidden');
  }

  return (
    <RequireRoleGate allowedRoles={['ADMIN', 'OPERATIONS', 'INSTALLER']}>
      <div className="h-full">{children}</div>
    </RequireRoleGate>
  );
}
