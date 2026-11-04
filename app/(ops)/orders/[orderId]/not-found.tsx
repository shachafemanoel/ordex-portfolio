import { RouteNotFound } from '@/components/layout/fallbacks/RouteNotFound';
import { translate } from '@/lib/i18n/translate';

export default function OrderNotFound() {
  const t = (key: string) => translate('ui', key);
  return (
    <RouteNotFound
      title={t('orders.detail.notFoundTitle')}
      description={t('orders.detail.notFoundDescription')}
    />
  );
}
