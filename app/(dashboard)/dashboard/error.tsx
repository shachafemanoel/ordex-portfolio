'use client';

import { RouteError } from '@/components/layout/fallbacks/RouteError';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="טעינת הדשבורד נכשלה"
      description="לא הצלחנו להציג את נתוני הניהול. נסו לרענן או לחזור לאחר מכן."
    />
  );
}
