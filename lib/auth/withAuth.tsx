'use client';

import { useAuth } from '@/components/AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Role } from '@/lib/auth/types';

interface WithAuthOptions {
  roles?: Role[];
  role?: Role; // Deprecated: use roles instead
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  return function WithAuth(props: P) {
    const { user, loading } = useAuth();

    if (loading) {
      return <LoadingSpinner />;
    }

    if (!user) {
      return <ErrorState error="You must be logged in to view this page." />;
    }

    // Support both singular role and roles array
    const allowedRoles = options.roles || (options.role ? [options.role] : null);

    if (allowedRoles && !allowedRoles.includes(user.role.key)) {
      return <ErrorState error="You do not have permission to view this page." />;
    }

    return <Component {...props} />;
  };
}
