import { DashboardPage } from '@/components/layout/templates/DashboardPage';
import { WooSyncOperations } from '@/components/settings/WooSyncOperations';
import { WooCommerceConnectionCard } from '@/components/settings/WooCommerceConnectionCard';

export const dynamic = 'force-dynamic';

export default function IntegrationsSettingsPage() {
  return (
    <DashboardPage title="אינטגרציות">
      <div className="mx-auto w-full max-w-3xl">
        <WooCommerceConnectionCard />
        <WooSyncOperations />
      </div>
    </DashboardPage>
  );
}
