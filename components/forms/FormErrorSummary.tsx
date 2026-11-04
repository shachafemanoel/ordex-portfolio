'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

interface FormErrorSummaryProps {
  messages: string[];
  title?: string;
  className?: string;
  id?: string;
}

export function FormErrorSummary({
  messages,
  title = 'אנא תקנו את השגיאות הבאות:',
  className,
  id,
}: FormErrorSummaryProps) {
  if (!messages.length) {
    return null;
  }

  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className={cn(
        'rounded-2xl border border-red-200 bg-red-50 p-4 text-right shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-3" dir="rtl">
        <div className="mt-1 text-red-600">
          <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-700">{title}</p>
          <ul className="list-disc pr-4 text-xs text-red-600">
            {messages.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
