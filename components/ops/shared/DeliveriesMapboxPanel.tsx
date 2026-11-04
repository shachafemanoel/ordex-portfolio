'use client';

import { DeliveryMapPreset } from '@/components/maps/presets';
import type { DeliveryMapHotspot, DeliveryMapInsight } from '@/lib/delivery-map-insights';

import type { DeliveryMapPoint } from './DeliveriesMapboxCanvas';

interface DeliveriesMapboxPanelProps {
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
}

export function DeliveriesMapboxPanel({
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
}: Readonly<DeliveriesMapboxPanelProps>) {
  return (
    <DeliveryMapPreset
      title={title}
      subtitle={subtitle}
      items={items}
      selectedItemId={selectedItemId}
      onSelect={onSelect}
      onOpenOperations={onOpenOperations}
      className={className}
      mapClassName={mapClassName}
      compact={compact}
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
      hotspots={hotspots}
      insights={insights}
      showStatOverlays={showStatOverlays}
      showRegionalHotspotLayers={showRegionalHotspotLayers}
      showHeatmap={showHeatmap}
      mapVariant={mapVariant}
      showScaleControl={showScaleControl}
      userLocationRadiusKm={userLocationRadiusKm}
      lockToIsraelViewport={lockToIsraelViewport}
      lockToUserLocationRadius={lockToUserLocationRadius}
      resolveUserLocation={resolveUserLocation}
      navigationCamera={navigationCamera}
      layout={layout}
    />
  );
}
