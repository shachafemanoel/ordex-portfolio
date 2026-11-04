import type { DashboardOverviewActivityItem } from './DashboardOverviewActivity';
import { DashboardOverviewContentGrid } from './DashboardOverviewContentGrid';
import { DashboardOverviewHeader } from './DashboardOverviewHeader';
import {
  DashboardOverviewQuickActions,
  type DashboardOverviewQuickAction,
} from './DashboardOverviewQuickActions';

export interface DashboardOverviewScreenProps {
  userName: string;
  dateLabel: string;
  quickActions: ReadonlyArray<DashboardOverviewQuickAction>;
  activityItems: ReadonlyArray<DashboardOverviewActivityItem>;
}

export function DashboardOverviewScreen({
  userName,
  dateLabel,
  quickActions,
  activityItems,
}: Readonly<DashboardOverviewScreenProps>) {
  const safeQuickActions = Array.isArray(quickActions) ? quickActions : [];
  const safeActivityItems = Array.isArray(activityItems) ? activityItems : [];

  return (
    <div className="relative min-h-full overflow-x-hidden bg-surface-muted">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,color-mix(in_srgb,var(--color-primary-600)_11%,transparent),transparent_50%),radial-gradient(ellipse_90%_60%_at_0%_110%,color-mix(in_srgb,var(--color-neutral-500)_8%,transparent),transparent_45%)]"
      />
      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-5 sm:gap-7 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <DashboardOverviewHeader userName={userName} dateLabel={dateLabel} />

        <DashboardOverviewQuickActions actions={safeQuickActions} />

        <DashboardOverviewContentGrid activityItems={safeActivityItems} />
      </div>
    </div>
  );
}
