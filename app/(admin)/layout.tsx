import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireRoleGate } from '@/components/layout/RequireRoleGate';
import { AuthenticatedShell } from '@/src/components/layout/AuthenticatedShell';
import { getCurrentUser } from '@/lib/auth/verifySession';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (user && user.role !== 'ADMIN') {
    redirect('/orders');
  }

  return (
    <AuthenticatedShell>
      <RequireRoleGate allowedRoles={['ADMIN']} fallbackHref="/orders">
        {children}
      </RequireRoleGate>
    </AuthenticatedShell>
  );
}
