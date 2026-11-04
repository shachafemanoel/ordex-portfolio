'use client';

import { DeliveriesWorkspace } from '@/components/ops/deliveries/DeliveriesWorkspace';
import { DeliveryHubKpiGrid } from '@/components/operations/delivery-hub/DeliveryHubKpiGrid';
import { DeliveryHubTabs } from '@/components/operations/delivery-hub/DeliveryHubTabs';
import { useDeliveryHubTabRouting } from '@/components/operations/delivery-hub/useDeliveryHubTabRouting';
import { Button } from '@/components/ui/Button';
import { StitchPageHeader, StitchPageShell } from '@/components/stitch/StitchShell';
import type { OperationsDashboardData } from '@/lib/services/dashboard/OperationsDashboardService';
import { Calendar, Package, Truck } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

export interface DeliveryOperationsHubProps {
  readonly data: OperationsDashboardData;
}

export function DeliveryOperationsHub({ data }: Readonly<DeliveryOperationsHubProps>) {
  const { hubTab, screenMode, setHubTab } = useDeliveryHubTabRouting();
  const formattedDateLabel = useMemo(
    () =>
      data.date.toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [data.date]
  );

  return (
    <StitchPageShell className="space-y-5">
      <StitchPageHeader
        title="ניהול משלוחים ואספקה"
        description="תיאום אספקה, מסלולים אופטימליים ומעקב אחרי משלוחים — במסך אחד."
        meta={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-[#75665d]">
              <Calendar className="h-3.5 w-3.5 text-accent-600" />
              {formattedDateLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-[#75665d]">
              <Truck className="h-3.5 w-3.5 text-accent-600" />
              לוח תפעול משלוחים
            </span>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/deliveries">מסך משלוחים (אפליקציה)</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders/calendar">יומן התקנות</Link>
            </Button>
          </>
        }
      />

      <DeliveryHubTabs hubTab={hubTab} onChangeTab={setHubTab} />

      <DeliveryHubKpiGrid kpis={data.kpis} />

      <div className="rounded-[28px] border border-[#f2ece8] bg-[#fffdfb] p-3 shadow-sm sm:p-4">
        <DeliveriesWorkspace screenMode={screenMode} navigationHost="dashboard" />
      </div>

      <div className="flex justify-center pb-6">
        <p className="flex items-center gap-2 text-center text-[11px] font-medium text-[#b5a69a]">
          <Package className="h-3.5 w-3.5" />
          נתוני מסלול וחימום מפה מסונכרנים עם מסך המשלוחים הראשי
        </p>
      </div>
    </StitchPageShell>
  );
}
