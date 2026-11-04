'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { AuthenticatedClientUser } from '@/components/AuthProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

/**
 * Client-side providers wrapper
 * This component wraps global client-side components
 * ToastProvider is now in AuthenticatedShell to ensure it works with parallel routes
 */
interface ClientProvidersProps {
  children: ReactNode;
  initialUser?: AuthenticatedClientUser | null;
}

export function ClientProviders({ children, initialUser }: ClientProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
