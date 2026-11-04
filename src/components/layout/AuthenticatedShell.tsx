import type { ReactNode } from 'react';

import { ClientAuthGate } from '@/components/layout/ClientAuthGate';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { QueryProvider } from '@/lib/hooks/api/shared/QueryProvider';
import { AppShell } from '@/components/layout';
import { ToastProvider } from '@/components/ui/ToastProvider';

interface AuthenticatedShellProps {
  children: ReactNode;
}

/**
 * Shared authenticated layout shell used by all route groups.
 * Provides auth gate, query client, tooltips, toasts, and app shell.
 *
 * ClientAuthGate only controls UI access; individual pages must still avoid running
 * expensive server work when `getCurrentUser()` is null (defer to client + authenticated API).
 */
export async function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const user = await getCurrentUser();

  return (
    <QueryProvider>
      <TooltipProvider>
        <ToastProvider>
          <ClientAuthGate serverAuthenticated={Boolean(user)}>
            <AppShell>{children}</AppShell>
          </ClientAuthGate>
        </ToastProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
