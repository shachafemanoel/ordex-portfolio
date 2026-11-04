import { StitchStatCard } from '@/components/stitch/StitchShell';
import type { OperationsDashboardData } from '@/lib/services/dashboard/OperationsDashboardService';
import { Calendar, MapPin, Navigation, Wrench } from 'lucide-react';

interface DeliveryHubKpiGridProps {
  kpis: OperationsDashboardData['kpis'];
}

export function DeliveryHubKpiGrid({ kpis }: Readonly<DeliveryHubKpiGridProps>) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StitchStatCard
        label="התקנות היום"
        value={kpis.installationsForDate.value}
        hint={`${kpis.installationsForDate.activeTeams} צוותים פעילים`}
        icon={Wrench}
        tone="primary"
      />
      <StitchStatCard
        label="התקנות למחר"
        value={kpis.installationsTomorrow.value}
        hint="מבט קדימה"
        icon={Calendar}
        tone="info"
      />
      <StitchStatCard
        label="ממתינים לשיבוץ"
        value={kpis.unscheduled.value}
        hint="דורש קביעת מועד"
        icon={MapPin}
        tone="warning"
      />
      <StitchStatCard
        label="משימות פתוחות"
        value={kpis.openTasks.value}
        hint={`${kpis.openTasks.urgent} דחופות`}
        icon={Navigation}
        tone="success"
      />
    </div>
  );
}
