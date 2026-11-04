'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { Button } from '@/components/ui/Button';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  supportNote?: string;
}

export function RouteError({
  error,
  reset,
  title = 'אירעה שגיאה בלתי צפויה',
  description = 'אנא נסו לרענן את העמוד או לחזור לדשבורד הראשי.',
  supportNote = 'אם השגיאה חוזרת על עצמה, אנא פנו לתמיכה עם פירוט הפעולה שבוצעה.',
}: RouteErrorProps) {
  useEffect(() => {
    // Log the error for debugging visibility in the console
    console.error('Route rendering error', error);
  }, [error]);

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 rounded-3xl border border-red-200 bg-white/95 p-10 text-right shadow-sm"
      dir="rtl"
      role="alert"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
        <ExclamationTriangleIcon className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
        <p className="text-xs text-gray-500">{supportNote}</p>
        {error.digest && (
          <p className="text-xs text-gray-400" dir="ltr">
            מזהה שגיאה: {error.digest}
          </p>
        )}
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
          className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-blue-500 px-5 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
