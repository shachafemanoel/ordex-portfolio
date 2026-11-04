import { AuthenticatedShell } from '@/src/components/layout/AuthenticatedShell';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
