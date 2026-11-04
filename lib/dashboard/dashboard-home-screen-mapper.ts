import type { DashboardOverviewScreenProps } from '@/components/dashboard/overview/DashboardOverviewScreen';
import type { DashboardHomeViewModelJson } from '@/lib/server/dashboard-home-view-model';

const MAX_QUICK_ACTIONS = 4;
const MAX_ACTIVITY_ITEMS = 5;

export function dashboardHomeJsonToScreenProps(
  json: DashboardHomeViewModelJson
): DashboardOverviewScreenProps {
  const quickActions = Array.isArray(json.quickActions) ? json.quickActions : [];
  const activityItems = Array.isArray(json.activityItems) ? json.activityItems : [];

  return {
    userName: json.userName,
    dateLabel: json.dateLabel,
    quickActions: quickActions.slice(0, MAX_QUICK_ACTIONS),
    activityItems: activityItems.slice(0, MAX_ACTIVITY_ITEMS),
  };
}
