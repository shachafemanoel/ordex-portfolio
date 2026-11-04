'use client';

import { DeliveriesMapboxCanvas, type DeliveryMapPoint } from '@/components/ops/shared/DeliveriesMapboxCanvas';
import { DeliveryMapLegendBar } from '@/components/maps/presets/DeliveryMapLegendBar';
import { MapOverlayChips } from '@/components/maps/presets/MapOverlayChips';
import { MapLegend } from '@/components/maps/presets/MapLegend';
import { StoreLocatorMapPreset } from '@/components/maps/presets/StoreLocatorMapPreset';
import { useMapboxConfig } from '@/components/maps/lib';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import type { DeliveryMapHotspot, DeliveryMapInsight } from '@/lib/delivery-map-insights';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Loader2, MapPinOff } from 'lucide-react';

type DeliveryMapPresetProps = {
  title?: string;
  subtitle?: string;
  items?: DeliveryMapPoint[] | null;
  selectedItemId?: string | null;
  onSelect?: (itemId: string) => void;
  onOpenOperations?: (itemId: string) => void;
  className?: string;
  mapClassName?: string;
  compact?: boolean;
  routeCoordinates?: Array<[number, number]>;
  secondaryRouteCoordinates?: Array<[number, number]>;
  routePaths?: Array<{
    id: string;
    coordinates: Array<[number, number]>;
    color?: string;
    dasharray?: number[];
  }>;
  origin?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  focusSelectedWithUserLocation?: boolean;
  showUserToSelectedLine?: boolean;
  routeDisplayMode?: 'full' | 'selected-only';
  recenterToUserSignal?: number;
  recenterToRouteSignal?: number;
  defaultCenterOnUserLocation?: boolean;
  enableInitialUserFocus?: boolean;
  disablePopups?: boolean;
  renderPointMarkers?: boolean;
  hotspots?: DeliveryMapHotspot[] | null;
  insights?: DeliveryMapInsight[] | null;
  showStatOverlays?: boolean;
  showRegionalHotspotLayers?: boolean;
  showHeatmap?: boolean;
  mapVariant?: 'dashboard' | 'field';
  showScaleControl?: boolean;
  userLocationRadiusKm?: number;
  lockToIsraelViewport?: boolean;
  lockToUserLocationRadius?: boolean;
  resolveUserLocation?: boolean;
  navigationCamera?: boolean;
  layout?: 'map' | 'split';
};

export function DeliveryMapPreset({
  title,
  subtitle,
  items,
  selectedItemId,
  onSelect,
  onOpenOperations,
  className,
  mapClassName,
  compact = false,
  routeCoordinates,
  secondaryRouteCoordinates,
  routePaths,
  origin,
  userLocation,
  focusSelectedWithUserLocation = false,
  showUserToSelectedLine = false,
  routeDisplayMode = 'full',
  recenterToUserSignal = 0,
  recenterToRouteSignal = 0,
  defaultCenterOnUserLocation = false,
  enableInitialUserFocus = true,
  disablePopups = false,
  renderPointMarkers = true,
  hotspots = [],
  insights = [],
  showStatOverlays = true,
  showRegionalHotspotLayers = true,
  showHeatmap = false,
  mapVariant = 'field',
  showScaleControl = false,
  userLocationRadiusKm,
  lockToIsraelViewport = false,
  lockToUserLocationRadius = false,
  resolveUserLocation = true,
  navigationCamera = false,
  layout = 'map',
}: Readonly<DeliveryMapPresetProps>) {
  const { t } = useUITranslation();
  const resolvedTitle = title ?? t('maps.preset.titleDefault');
  const resolvedSubtitle = subtitle ?? t('maps.preset.subtitleDefault');
  const safeItems = Array.isArray(items) ? items : [];
  const safeHotspots = Array.isArray(hotspots) ? hotspots : [];
  const safeInsights = Array.isArray(insights) ? insights : [];
  const topHotspots = safeHotspots.slice(0, 3);
  const availableItems = safeItems.filter(
    (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
      typeof item.lat === 'number' && typeof item.lng === 'number'
  );

  const { accessToken, styleId, isLoading, isError, hasMapboxConfig } = useMapboxConfig();
  const hasSidePanelContent = showStatOverlays && (safeInsights.length > 0 || topHotspots.length > 0);

  const mapNode = (
    <div
      className={cn(
        'relative h-full min-h-0 w-full min-w-0',
        compact ? 'min-h-0' : 'min-h-[220px] sm:min-h-[280px]'
      )}
    >
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className={cn(
            'flex h-full w-full items-center justify-center rounded-[22px] border border-surface-soft bg-surface-translucent backdrop-blur-md',
            compact ? 'min-h-0 rounded-none border-0' : 'min-h-[220px] sm:min-h-[280px]'
          )}
        >
          <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
          <span className="sr-only">{t('maps.loading')}</span>
        </div>
      ) : !hasMapboxConfig ? (
        <div
          role="status"
          className={cn(
            'flex h-full w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-surface-soft bg-surface-translucent px-4 text-center backdrop-blur-sm',
            compact ? 'min-h-0 rounded-none border-0' : 'min-h-[220px] sm:min-h-[280px]'
          )}
        >
          <MapPinOff className="h-8 w-8 text-ops-icon-muted" />
          <div className="text-sm font-bold text-fg-muted">{t('maps.unavailableTitle')}</div>
          <div className="text-xs font-medium text-ops-icon-muted">
            {isError ? t('maps.unavailableHintError') : t('maps.unavailableHintNoToken')}
          </div>
        </div>
      ) : (
        <DeliveriesMapboxCanvas
          accessToken={accessToken}
          styleId={styleId}
          items={availableItems}
          selectedItemId={selectedItemId}
          onSelect={onSelect}
          onOpenOperations={onOpenOperations}
          className={cn('h-full w-full rounded-[22px] border border-surface-soft', mapClassName)}
          routeCoordinates={routeCoordinates}
          secondaryRouteCoordinates={secondaryRouteCoordinates}
          routePaths={routePaths}
          origin={origin}
          userLocation={userLocation}
          focusSelectedWithUserLocation={focusSelectedWithUserLocation}
          showUserToSelectedLine={showUserToSelectedLine}
          routeDisplayMode={routeDisplayMode}
          recenterToUserSignal={recenterToUserSignal}
          recenterToRouteSignal={recenterToRouteSignal}
          defaultCenterOnUserLocation={defaultCenterOnUserLocation}
          enableInitialUserFocus={enableInitialUserFocus}
          disablePopups={disablePopups}
          renderPointMarkers={renderPointMarkers}
          hotspots={safeHotspots}
          showRegionalHotspotLayers={showRegionalHotspotLayers}
          showHeatmap={showHeatmap}
          mapVariant={mapVariant}
          showScaleControl={showScaleControl}
          userLocationRadiusKm={userLocationRadiusKm}
          lockToIsraelViewport={lockToIsraelViewport}
          lockToUserLocationRadius={lockToUserLocationRadius}
          resolveUserLocation={resolveUserLocation}
          navigationCamera={navigationCamera}
        />
      )}
    </div>
  );

  const sidePanelNode = hasSidePanelContent ? (
    <aside className="rounded-[22px] border border-surface-soft bg-surface-translucent p-3 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.5)] backdrop-blur-md">
      <MapOverlayChips
        chips={safeInsights.map((insight) => ({
          id: insight.id,
          label: insight.label,
          value: insight.value,
          tone: insight.tone,
        }))}
      />
      <div className={cn(safeInsights.length > 0 && topHotspots.length > 0 && 'mt-3')}>
        <MapLegend
          title={t('maps.sidePanel.hotZonesTitle')}
          items={topHotspots.map((hotspot) => ({
            id: hotspot.id,
            label: t('maps.sidePanel.hotspotLine', undefined, {
              params: { label: hotspot.label, count: hotspot.count },
            }),
            color: hotspot.color,
          }))}
        />
      </div>
    </aside>
  ) : null;

  if (layout === 'split') {
    return (
      <StoreLocatorMapPreset
        items={safeItems.map((item) => ({
          id: item.id,
          title: item.customerName,
          subtitle: item.addressLine,
          lat: item.lat,
          lng: item.lng,
          statusLabel: item.status,
        }))}
        userLocation={userLocation}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
        renderMap={() => (
          <div className={cn('grid h-full min-h-[260px] grid-cols-1 gap-3', hasSidePanelContent && '2xl:grid-cols-[minmax(0,1fr)_300px]')}>
            {mapNode}
            {sidePanelNode}
          </div>
        )}
        className={cn('h-full', className)}
      />
    );
  }

  return (
    <section
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-col rounded-[24px] border border-surface-soft bg-surface-translucent p-3 backdrop-blur-md sm:p-4',
        compact && 'rounded-none border-0 bg-transparent p-0',
        className
      )}
    >
      {!compact ? (
        <div className="mb-3 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-fg">{resolvedTitle}</div>
              <div className="mt-1 text-xs font-medium text-fg-muted">{resolvedSubtitle}</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="cursor-default rounded-full border border-brand-soft bg-info-soft px-3 py-1 text-[11px] font-black text-brand-deep tabular-nums"
                  tabIndex={0}
                >
                  {t('maps.geocodedCountBadge', undefined, { params: { count: availableItems.length } })}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-xs font-medium">
                {t('maps.geocodedCountTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <DeliveryMapLegendBar items={safeItems} mapVariant={mapVariant} />
        </div>
      ) : null}
      <div
        className={cn(
          'grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3',
          hasSidePanelContent && 'xl:grid-cols-[minmax(0,1fr)_300px]'
        )}
      >
        {mapNode}
        {sidePanelNode}
      </div>
    </section>
  );
}
