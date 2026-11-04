import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';

interface AccessDeniedProps {
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function AccessDenied({
  title = 'אין הרשאה',
  description = 'אין לך הרשאות לצפות בעמוד זה. אם לדעתך מדובר בטעות, פנה למנהל המערכת.',
  actionHref = '/dashboard',
  actionLabel = 'חזרה לדשבורד',
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4" dir="rtl">
      <Card className="max-w-lg w-full border border-red-100">
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-3xl">⛔️</div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-on-dark transition hover:bg-blue-700"
          >
            {actionLabel}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
