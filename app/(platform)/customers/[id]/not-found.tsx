'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';

export default function CustomerNotFound() {
  const { t, direction } = useUITranslation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4" dir={direction}>
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center space-y-3">
          <h1 className="text-2xl font-bold text-slate-900">{t('customers.notFound.title')}</h1>
          <p className="text-sm text-slate-600">
            {t('customers.notFound.description')}
          </p>
          <Link
            href="/customers"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-on-dark transition hover:bg-blue-700"
          >
            {t('customers.notFound.backToList')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
