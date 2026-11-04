'use client';

import Link from 'next/link';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/Button';

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 rounded-3xl border border-[var(--color-danger-200)] bg-surface-translucent-strong p-10 text-right shadow-sm"
      dir="rtl"
      role="alert"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-danger-50)] text-danger">
        <ExclamationTriangleIcon className="h-10 w-10" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-fg">טעינת ההזמנות נכשלה</h2>
        <p className="text-sm text-fg-muted">
          אירעה תקלה בזמן הטעינה. נסו לרענן או לחזור לדשבורד ולפתוח מחדש את המודול.
        </p>
        {error.digest ? (
          <p className="text-xs text-fg-subtle" dir="ltr">
            מזהה שגיאה: {error.digest}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={reset}
          className="min-w-[140px]"
          icon={<ArrowPathIcon className="h-5 w-5" aria-hidden="true" />}
        >
          נסו שוב
        </Button>
        <Link
          href="/dashboard"
          className="focus-ring inline-flex min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-brand px-5 py-2 text-sm font-semibold text-brand transition hover:bg-primary-50"
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
