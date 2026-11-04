import { DashboardPage } from '@/components/layout/templates/DashboardPage';
import { StoreSettingsWorkspace } from '@/components/settings/StoreSettingsWorkspace';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <DashboardPage title="הגדרות חנות ומערכת">
      <StoreSettingsWorkspace />
    </DashboardPage>
  );
}
