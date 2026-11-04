import { DeferredDashboardHome } from '@/components/dashboard/DeferredDashboardHome';
import { DashboardOverviewScreen } from '@/components/dashboard/overview/DashboardOverviewScreen';
import { dashboardHomeJsonToScreenProps } from '@/lib/dashboard/dashboard-home-screen-mapper';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { loadDashboardHomeViewModelJson } from '@/lib/server/dashboard-home-view-model';

export const revalidate = 30; // Cache for 30 seconds for better performance

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-full bg-transparent font-sans">
        <DeferredDashboardHome />
      </div>
    );
  }

  const vmJson = await loadDashboardHomeViewModelJson(user.name);
  const props = dashboardHomeJsonToScreenProps(vmJson);

  return (
    <div className="min-h-full bg-transparent font-sans">
      <DashboardOverviewScreen {...props} />
    </div>
  );
}
