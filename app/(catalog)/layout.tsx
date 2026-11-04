import { AuthenticatedShell } from '@/src/components/layout/AuthenticatedShell';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
