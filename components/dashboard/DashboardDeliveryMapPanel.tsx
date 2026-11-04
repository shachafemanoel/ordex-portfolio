'use client';

import type { DeliveryMapPoint } from '@/components/ops/shared/DeliveriesMapboxCanvas';
import type { DeliveryMapHotspot } from '@/lib/delivery-map-insights';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { DeliveriesMapboxPanel } from '@/components/ops/shared/DeliveriesMapboxPanel';

interface DashboardDeliveryMapPanelProps {
  compact?: boolean;
  items?: ReadonlyArray<DeliveryMapPoint> | null;
  hotspots?: ReadonlyArray<DeliveryMapHotspot> | null;
}

export function DashboardDeliveryMapPanel({
  compact,
  items,
  hotspots,
}: Readonly<DashboardDeliveryMapPanelProps> = {}) {
  const { t } = useUITranslation();
  return (
    <DeliveriesMapboxPanel
      title={t('dashboard.deliveryMap.title')}
      subtitle={t('dashboard.deliveryMap.subtitle')}
      mapVariant="dashboard"
      items={items ? [...items] : undefined}
      hotspots={hotspots ? [...hotspots] : undefined}
      className="flex-1 h-full min-h-0 w-full min-w-0 rounded-none border-0 bg-transparent p-0"
      mapClassName="h-full min-h-0 w-full min-w-0 rounded-none border-0"
      compact={compact}
      layout="map"
      disablePopups
      defaultCenterOnUserLocation
      userLocationRadiusKm={20}
      lockToUserLocationRadius
      renderPointMarkers={false}
      showScaleControl
      showStatOverlays={false}
      showRegionalHotspotLayers
      showHeatmap
    />
  );
}
