'use client';

import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { useEffect } from 'react';

export default function OrderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, direction } = useUITranslation();
  useEffect(() => {
    console.error('Order page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center" dir={direction}>
      <h2 className="text-2xl font-bold text-fg">{t('orders.detail.errorTitle')}</h2>
      <p className="text-fg-muted max-w-md">
        {t('orders.detail.errorDescription')}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => window.location.href = '/orders'}
          className="rounded-md border border-subtle bg-surface px-4 py-2 text-sm font-medium text-fg-muted transition hover:bg-surface-muted"
        >
          {t('orders.detail.backToOrders')}
        </button>
        <button
          onClick={() => reset()}
          className="rounded-md bg-nav-cta px-4 py-2 text-sm font-medium text-on-dark transition hover:opacity-90"
        >
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
}
