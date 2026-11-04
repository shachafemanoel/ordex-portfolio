import { DashboardSkeleton } from '@/components/ui/Skeletons';

export default function DashboardLoading() {
  return (
    <div className="w-full space-y-[var(--app-shell-gap)] animate-pulse">
      <DashboardSkeleton />
    </div>
  );
}
