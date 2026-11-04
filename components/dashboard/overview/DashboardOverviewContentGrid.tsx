import {
  DashboardOverviewActivity,
  type DashboardOverviewActivityItem,
} from './DashboardOverviewActivity';
import { DashboardOverviewMapPanel } from './DashboardOverviewMapPanel';

export interface DashboardOverviewContentGridProps {
  activityItems: ReadonlyArray<DashboardOverviewActivityItem>;
}

export function DashboardOverviewContentGrid({
  activityItems,
}: Readonly<DashboardOverviewContentGridProps>) {
  const safeActivityItems = Array.isArray(activityItems) ? activityItems : [];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.9fr)] xl:items-stretch xl:gap-6">
      <div className="flex min-h-[320px] flex-col xl:h-[min(58vh,34rem)]">
        <DashboardOverviewActivity items={safeActivityItems} />
      </div>

      <div className="flex min-h-[320px] flex-col xl:h-[min(58vh,34rem)]">
        <DashboardOverviewMapPanel />
      </div>
    </div>
  );
}
