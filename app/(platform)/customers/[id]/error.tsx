'use client';

import { RouteError } from '@/components/layout/fallbacks/RouteError';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';

export default function CustomerDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useUITranslation();

  return (
    <RouteError
      error={error}
      reset={reset}
      title={t('customers.error.title')}
      description={t('customers.error.description')}
    />
  );
}
