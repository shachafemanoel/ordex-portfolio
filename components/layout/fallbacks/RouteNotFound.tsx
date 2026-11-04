import Link from 'next/link';
import { FaceFrownIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

interface RouteNotFoundProps {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function RouteNotFound({
  title = 'לא מצאנו את העמוד',
  description = 'ייתכן שהכתובת שגויה או שהתוכן הועבר למיקום אחר.',
  actionHref = '/dashboard',
  actionLabel = 'חזרה לדשבורד',
}: RouteNotFoundProps) {
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-gray-200 bg-white/90 p-10 text-right shadow-sm"
      dir="rtl"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <FaceFrownIcon className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex items-center gap-2 rounded-2xl border border-blue-500 bg-white px-5 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        aria-label={actionLabel}
      >
        <ArrowUturnLeftIcon className="h-5 w-5" aria-hidden="true" />
        {actionLabel}
      </Link>
    </div>
  );
}
