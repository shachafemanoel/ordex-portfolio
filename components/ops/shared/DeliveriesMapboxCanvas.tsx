'use client';

import { useLocale } from '@/contexts/I18nContext';
import type { DeliveryMapHotspot } from '@/lib/delivery-map-insights';
import { PRIMARY_HEX_500 } from '@/lib/designTokens';
import type { Locale } from '@/lib/i18n/types';
import { translate } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { isReadyForShipment } from '@/lib/delivery-map-status';
import { getUserLocation } from '@/lib/utils/geocodingUtils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { applyDeliveryMapCartography } from './deliveryMapCartography';
import styles from './DeliveriesMapboxCanvas.module.css';

export interface DeliveryMapPoint {
  id: string;
  number: string;
  customerName: string;
  status: string;
  addressLine: string;
  city: string | null;
  scheduledAt: string | null;
  lat: number | null;
  lng: number | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  routeIndex?: number | null;
  estimatedArrivalAt?: string | null;
  estimatedCompletionAt?: string | null;
  geocodeSource?: 'existing' | 'mapbox' | 'missing';
  routeBucket?: 'today' | 'tomorrow';
  autoDeferredToDate?: string | null;
  groupId?: string | null;
  groupLabel?: string | null;
  groupColor?: string | null;
  workerIndex?: number | null;
  markerTone?: 'planned-today' | 'completed-today';
}

interface DeliveriesMapboxCanvasProps {
  accessToken: string;
  styleId: string;
  items?: DeliveryMapPoint[] | null;
  selectedItemId?: string | null;
  onSelect?: (itemId: string) => void;
  onOpenOperations?: (itemId: string) => void;
  className?: string;
  routeCoordinates?: Array<[number, number]> | null;
  secondaryRouteCoordinates?: Array<[number, number]> | null;
  routePaths?: Array<{
    id: string;
    coordinates: Array<[number, number]>;
    color?: string;
    dasharray?: number[];
  }> | null;
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
  /** When true with showHeatmap, draws regional circles + labels on the map. */
  showRegionalHotspotLayers?: boolean;
  showHeatmap?: boolean;
  mapVariant?: 'dashboard' | 'field';
  showScaleControl?: boolean;
  userLocationRadiusKm?: number;
  lockToIsraelViewport?: boolean;
  lockToUserLocationRadius?: boolean;
  resolveUserLocation?: boolean;
  /** After fitting user→stop, tilt and rotate like turn-by-turn navigation */
  navigationCamera?: boolean;
}

const DEFAULT_CENTER: [number, number] = [34.83632, 32.061009];
const DEFAULT_ZOOM = 10.37;
const DEFAULT_PITCH = 8.76;
const DEFAULT_BEARING = 39.9;

const ISRAEL_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [33.5, 29.4], // Southwest coordinates (approx Sinai border)
  [35.9, 33.3], // Northeast coordinates (approx Hermon)
];

type MarkerPhase = 'pickup' | 'transit' | 'coordination';

function getMarkerPhase(item: Pick<DeliveryMapPoint, 'status' | 'scheduledAt'>): MarkerPhase {
  if (item.status === 'IN_TRANSIT' || item.status === 'INSTALLATION') {
    return 'transit';
  }

  if (
    !item.scheduledAt &&
    ['READY_FOR_INSTALL', 'READY', 'INSTALL_SCHEDULING'].includes(item.status)
  ) {
    return 'coordination';
  }

  return 'pickup';
}

function getMarkerTheme(item: Pick<
  DeliveryMapPoint,
  'status' | 'scheduledAt' | 'routeBucket' | 'autoDeferredToDate' | 'markerTone'
>) {
  const phase = getMarkerPhase(item);
  const isDeferred = item.routeBucket === 'tomorrow' || Boolean(item.autoDeferredToDate);

  if (item.markerTone === 'completed-today') {
    return {
      phase,
      fill: '#16a34a',
      ring: '#bbf7d0',
      text: '#ffffff',
      chipBg: '#ecfdf3',
      chipText: '#166534',
      glow: 'rgba(22, 163, 74, 0.3)',
      deferredOpacity: '1',
    };
  }

  if (item.markerTone === 'planned-today') {
    return {
      phase,
      fill: '#0b84ff',
      ring: '#bfdbfe',
      text: '#ffffff',
      chipBg: '#edf5ff',
      chipText: '#0057b8',
      glow: 'rgba(11, 132, 255, 0.3)',
      deferredOpacity: '1',
    };
  }

  if (phase === 'coordination') {
    return {
      phase,
      fill: '#64748b',
      ring: '#d7dee8',
      text: '#ffffff',
      chipBg: '#eef2f7',
      chipText: '#4b5563',
      glow: 'rgba(100, 116, 139, 0.26)',
      deferredOpacity: isDeferred ? '0.82' : '1',
    };
  }

  if (phase === 'transit') {
    return {
      phase,
      fill: '#f97316',
      ring: '#fed7aa',
      text: '#ffffff',
      chipBg: '#fff1e8',
      chipText: '#c2410c',
      glow: 'rgba(249, 115, 22, 0.28)',
      deferredOpacity: isDeferred ? '0.82' : '1',
    };
  }

  return {
    phase,
    fill: '#0b84ff',
    ring: '#bfdbfe',
    text: '#ffffff',
    chipBg: '#edf5ff',
    chipText: '#0057b8',
    glow: 'rgba(11, 132, 255, 0.3)',
    deferredOpacity: isDeferred ? '0.82' : '1',
  };
}

function getPhaseLabel(item: Pick<DeliveryMapPoint, 'status' | 'scheduledAt'>, locale: Locale) {
  const phase = getMarkerPhase(item);
  if (phase === 'coordination') {
    return translate('ui', 'maps.phase.coordination', undefined, { locale });
  }
  if (phase === 'transit') {
    return translate('ui', 'maps.phase.transit', undefined, { locale });
  }
  return translate('ui', 'maps.phase.pickup', undefined, { locale });
}

function getOperationsLabel(item: Pick<DeliveryMapPoint, 'status' | 'scheduledAt'>, locale: Locale) {
  const phase = getMarkerPhase(item);
  if (phase === 'coordination') {
    return translate('ui', 'maps.operations.openCoordination', undefined, { locale });
  }
  if (phase === 'transit') {
    return translate('ui', 'maps.operations.openDelivery', undefined, { locale });
  }
  return translate('ui', 'maps.operations.openPickup', undefined, { locale });
}

function getMarkerBadge(item: Pick<DeliveryMapPoint, 'routeIndex' | 'scheduledAt' | 'status'>) {
  if (typeof item.routeIndex === 'number' && Number.isFinite(item.routeIndex)) {
    return String(item.routeIndex);
  }

  if (isOverdueSchedule(item.scheduledAt ?? null)) {
    return '!';
  }

  return getMarkerPhase(item).charAt(0).toUpperCase();
}

function formatScheduleLabel(value: string | null, locale: Locale) {
  const notSet = translate('ui', 'maps.schedule.notSet', undefined, { locale });
  if (!value) return notSet;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notSet;

  return date.toLocaleString(locale === 'en' ? 'en-US' : 'he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEtaLabel(value: number | null | undefined, locale: Locale) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return translate('ui', 'maps.eta.unavailable', undefined, { locale });
  }

  if (value < 60) {
    return translate('ui', 'maps.eta.minutes', undefined, { locale, params: { minutes: value } });
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes
    ? translate('ui', 'maps.eta.hoursMinutes', undefined, {
        locale,
        params: { hours, minutes },
      })
    : translate('ui', 'maps.eta.hoursOnly', undefined, { locale, params: { hours } });
}

function formatClockTime(value: string | null | undefined, locale: Locale) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDeferredDateLabel(value: string | null | undefined, locale: Locale) {
  if (!value) return null;

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'he-IL', {
    day: '2-digit',
    month: '2-digit',
  });
}

function isOverdueSchedule(value: string | null) {
  if (!value) return false;

  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function getHeatmapWeight(item: DeliveryMapPoint) {
  let score = 1;

  if (isOverdueSchedule(item.scheduledAt)) {
    score += 1.8;
  }

  if (item.status === 'IN_TRANSIT' || item.status === 'INSTALLATION') {
    score += 0.9;
  }

  if (item.routeBucket === 'tomorrow' || item.autoDeferredToDate) {
    score += 0.6;
  }

  return score;
}

function isReadyShipmentItem(item: DeliveryMapPoint) {
  return isReadyForShipment(item);
}

function buildHeatmapFeatureCollection(items: DeliveryMapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: items
      .filter(
        (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
          typeof item.lat === 'number' && typeof item.lng === 'number'
      )
      .map((item) => ({
        type: 'Feature' as const,
        properties: {
          id: item.id,
          weight: getHeatmapWeight(item),
          overdue: isOverdueSchedule(item.scheduledAt) ? 1 : 0,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [item.lng, item.lat],
        },
      })),
  };
}

function buildReadyShipmentFeatureCollection(items: DeliveryMapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: items
      .filter(
        (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
          typeof item.lat === 'number' && typeof item.lng === 'number' && isReadyShipmentItem(item)
      )
      .map((item) => ({
        type: 'Feature' as const,
        properties: {
          id: item.id,
          number: item.number,
          customerName: item.customerName,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [item.lng, item.lat],
        },
      })),
  };
}

function buildHotspotsFeatureCollection(hotspots: DeliveryMapHotspot[]) {
  return {
    type: 'FeatureCollection' as const,
    features: hotspots.map((hotspot) => ({
      type: 'Feature' as const,
      properties: {
        id: hotspot.id,
        label: hotspot.label,
        count: hotspot.count,
        overdueCount: hotspot.overdueCount,
        score: hotspot.score,
        radius: hotspot.radius,
        color: hotspot.color,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [hotspot.lng, hotspot.lat],
      },
    })),
  };
}

function getStyleUrl(styleId: string) {
  return styleId.startsWith('mapbox://styles/') ? styleId : `mapbox://styles/${styleId}`;
}

function buildPopupContent(
  item: DeliveryMapPoint,
  callbacks: {
    onSelect?: (itemId: string) => void;
    onOpenOperations?: (itemId: string) => void;
  },
  locale: Locale
) {
  const root = document.createElement('div');
  root.className = styles.popupCard;
  root.dir = locale === 'en' ? 'ltr' : 'rtl';

  const header = document.createElement('div');
  header.className = styles.popupHeader;

  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = styles.popupEyebrow;
  eyebrow.textContent = translate('ui', 'maps.popup.orderEyebrow', undefined, {
    locale,
    params: { number: item.number },
  });

  const title = document.createElement('h3');
  title.className = styles.popupTitle;
  title.textContent = item.customerName;

  titleGroup.appendChild(eyebrow);
  titleGroup.appendChild(title);

  const phase = document.createElement('span');
  phase.className = styles.popupPhase;
  phase.textContent = getPhaseLabel(item, locale);
  const markerTheme = getMarkerTheme(item);
  phase.style.background = markerTheme.chipBg;
  phase.style.color = markerTheme.chipText;
  phase.style.borderColor = markerTheme.ring;

  header.appendChild(titleGroup);
  header.appendChild(phase);

  const description = document.createElement('p');
  description.className = styles.popupDescription;
  description.textContent = item.addressLine;

  root.appendChild(header);
  root.appendChild(description);

  if (item.city) {
    const city = document.createElement('p');
    city.className = styles.popupMeta;
    city.textContent = item.city;
    root.appendChild(city);
  }

  const schedule = document.createElement('p');
  schedule.className = styles.popupMeta;
  schedule.textContent = translate('ui', 'maps.popup.schedule', undefined, {
    locale,
    params: { time: formatScheduleLabel(item.scheduledAt, locale) },
  });
  root.appendChild(schedule);

  if (item.groupLabel) {
    const zone = document.createElement('p');
    zone.className = styles.popupMeta;
    zone.textContent = translate('ui', 'maps.popup.zone', undefined, {
      locale,
      params: { label: item.groupLabel },
    });
    root.appendChild(zone);
  }

  const arrivalLabel = formatClockTime(item.estimatedArrivalAt, locale);
  if (arrivalLabel) {
    const arrival = document.createElement('p');
    arrival.className = styles.popupMeta;
    arrival.textContent = translate('ui', 'maps.popup.estimatedArrival', undefined, {
      locale,
      params: { time: arrivalLabel },
    });
    root.appendChild(arrival);
  }

  const completionLabel = formatClockTime(item.estimatedCompletionAt, locale);
  if (completionLabel) {
    const completion = document.createElement('p');
    completion.className = styles.popupMeta;
    completion.textContent = translate('ui', 'maps.popup.estimatedCompletion', undefined, {
      locale,
      params: { time: completionLabel },
    });
    root.appendChild(completion);
  }

  const chips = document.createElement('div');
  chips.className = styles.popupChips;

  const etaChip = document.createElement('span');
  etaChip.className = styles.popupChip;
  etaChip.textContent = formatEtaLabel(item.etaMinutes, locale);
  chips.appendChild(etaChip);

  if (isOverdueSchedule(item.scheduledAt)) {
    const overdueChip = document.createElement('span');
    overdueChip.className = `${styles.popupChip} ${styles.popupChipDanger}`;
    overdueChip.textContent = translate('ui', 'maps.popup.overdue', undefined, { locale });
    chips.appendChild(overdueChip);
  }

  if (typeof item.distanceKm === 'number') {
    const distanceChip = document.createElement('span');
    distanceChip.className = styles.popupChip;
    distanceChip.textContent = translate('ui', 'maps.popup.distanceKm', undefined, {
      locale,
      params: { km: item.distanceKm },
    });
    chips.appendChild(distanceChip);
  }

  if (typeof item.routeIndex === 'number') {
    const routeChip = document.createElement('span');
    routeChip.className = styles.popupChip;
    routeChip.textContent = translate('ui', 'maps.popup.stopIndex', undefined, {
      locale,
      params: { index: item.routeIndex },
    });
    chips.appendChild(routeChip);
  }

  if (item.autoDeferredToDate) {
    const deferredLabel = formatDeferredDateLabel(item.autoDeferredToDate, locale);
    const deferredChip = document.createElement('span');
    deferredChip.className = `${styles.popupChip} ${styles.popupChipInfo}`;
    deferredChip.textContent = deferredLabel
      ? translate('ui', 'maps.popup.deferredTo', undefined, { locale, params: { date: deferredLabel } })
      : translate('ui', 'maps.popup.deferred', undefined, { locale });
    chips.appendChild(deferredChip);
  }

  root.appendChild(chips);

  if (callbacks.onOpenOperations) {
    const actions = document.createElement('div');
    actions.className = styles.popupActions;

    const operationsButton = document.createElement('button');
    operationsButton.type = 'button';
    operationsButton.className = styles.popupActionPrimary;
    operationsButton.textContent = getOperationsLabel(item, locale);
    operationsButton.style.background = markerTheme.fill;
    operationsButton.style.boxShadow = `0 10px 28px -12px ${markerTheme.glow}`;
    operationsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onSelect?.(item.id);
      callbacks.onOpenOperations?.(item.id);
    });

    actions.appendChild(operationsButton);
    root.appendChild(actions);
  }

  return root;
}

function createOriginElement() {
  const element = document.createElement('div');
  element.className = styles.originMarker;
  element.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
  return element;
}

function createUserLocationElement() {
  const element = document.createElement('div');
  element.className = styles.userMarker;
  return element;
}

function getMarkerRouteCaption(item: DeliveryMapPoint, locale: Locale) {
  return typeof item.routeIndex === 'number' && Number.isFinite(item.routeIndex)
    ? translate('ui', 'maps.popup.stopIndex', undefined, { locale, params: { index: item.routeIndex } })
    : getPhaseLabel(item, locale);
}

function createCustomerMarkerElement(
  item: DeliveryMapPoint,
  isSelected: boolean,
  mapVariant: 'dashboard' | 'field',
  locale: Locale
) {
  const theme = getMarkerTheme(item);
  const container = document.createElement('button');
  container.type = 'button';
  container.className = cn(styles.customerMarker, mapVariant === 'dashboard' && styles.customerMarkerDashboard);
  if (isSelected) {
    container.dataset.selected = 'true';
  }
  if (item.routeBucket === 'tomorrow' || item.autoDeferredToDate) {
    container.dataset.deferred = 'true';
  }
  container.style.setProperty('--marker-fill', theme.fill);
  container.style.setProperty('--marker-ring', theme.ring);
  container.style.setProperty('--marker-text', theme.text);
  container.style.setProperty('--marker-glow', theme.glow);
  container.style.setProperty('--marker-opacity', theme.deferredOpacity);

  const badge = getMarkerBadge(item);
  const routeLabel = getMarkerRouteCaption(item, locale);
  const showCaption = mapVariant === 'field';
  const captionHtml = showCaption
    ? `<div class="${styles.customerMarkerCaption}">${routeLabel}</div>`
    : '';

  container.innerHTML = `
    <div class="${styles.customerPinHalo}"></div>
    <div class="${styles.customerPin}">
      <div class="${styles.customerPinInner}">
        <span class="${styles.customerPinLabel}">${badge}</span>
      </div>
    </div>
    <div class="${styles.customerPinStem}"></div>
    ${captionHtml}
  `;
  return container;
}

async function fetchRealTimeEta(
  accessToken: string,
  userLoc: { lat: number; lng: number },
  destLoc: { lat: number; lng: number }
): Promise<{ duration: number; distance: number; geometry: Array<[number, number]> } | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLoc.lng},${userLoc.lat};${destLoc.lng},${destLoc.lat}?access_token=${accessToken}&overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    const coordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(coordinates) && data?.routes?.[0]) {
      return {
        duration: Math.round(data.routes[0].duration / 60),
        distance: Number((data.routes[0].distance / 1000).toFixed(1)),
        geometry: coordinates.map((coord: [number, number]) => [
          coord[1],
          coord[0],
        ]),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching real-time ETA:', error);
    return null;
  }
}

function focusMapOnCurrentLocation(
  map: mapboxgl.Map,
  location: { lat: number; lng: number },
  zoom = 13.2
) {
  map.easeTo({
    center: [location.lng, location.lat],
    zoom: Math.max(map.getZoom(), zoom),
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    duration: 700,
  });
}

function fitMapToLocationRadius(
  map: mapboxgl.Map,
  location: { lat: number; lng: number },
  radiusKm: number
) {
  const container = map.getContainer();
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);
  const aspectRatio = width / height;
  const baseRadiusKm = Math.max(radiusKm, 0.5);
  const horizontalRadiusKm = baseRadiusKm * Math.max(aspectRatio, 1);
  const verticalRadiusKm = baseRadiusKm * Math.max(1 / aspectRatio, 1);
  const latDelta = verticalRadiusKm / 110.574;
  const lngDelta =
    horizontalRadiusKm /
    Math.max(111.32 * Math.cos((location.lat * Math.PI) / 180), 0.01);
  const bounds = new mapboxgl.LngLatBounds(
    [location.lng - lngDelta, location.lat - latDelta],
    [location.lng + lngDelta, location.lat + latDelta]
  );
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const padding = isMobile
    ? { top: 24, right: 20, bottom: 24, left: 20 }
    : { top: 28, right: 28, bottom: 28, left: 28 };

  map.fitBounds(bounds, {
    padding,
    duration: 700,
    maxZoom: 13.9,
  });
}

function getLockedRadiusCenter(userLocation?: { lat: number; lng: number } | null) {
  return userLocation ?? { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] };
}

function fitMapToIsraelBounds(map: mapboxgl.Map) {
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const requestedPadding = isMobile
    ? { top: 20, right: 16, bottom: 20, left: 16 }
    : { top: 26, right: 26, bottom: 26, left: 26 };
  const maxHorizontalPadding = Math.max(Math.floor((width - 12) / 2), 0);
  const maxVerticalPadding = Math.max(Math.floor((height - 12) / 2), 0);
  const padding = {
    top: Math.min(requestedPadding.top, maxVerticalPadding),
    right: Math.min(requestedPadding.right, maxHorizontalPadding),
    bottom: Math.min(requestedPadding.bottom, maxVerticalPadding),
    left: Math.min(requestedPadding.left, maxHorizontalPadding),
  };

  if (width < 96 || height < 96) {
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: 6.8,
      pitch: 0,
      bearing: 0,
      duration: 0,
    });
    return;
  }

  try {
    map.fitBounds(ISRAEL_BOUNDS, {
      padding,
      duration: 700,
      maxZoom: 7.4,
      pitch: 0,
      bearing: 0,
    });
  } catch {
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: 6.8,
      pitch: 0,
      bearing: 0,
      duration: 0,
    });
  }
}

function fitMapToPoints(
  map: mapboxgl.Map,
  items: Array<DeliveryMapPoint & { lat: number; lng: number }>,
  origin?: { lat: number; lng: number } | null
) {
  const bounds = new mapboxgl.LngLatBounds();

  if (origin) {
    bounds.extend([origin.lng, origin.lat]);
  }

  items.forEach((item) => bounds.extend([item.lng, item.lat]));

  if (bounds.isEmpty()) {
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 500,
    });
    return;
  }

  if (items.length === 1 && !origin) {
    map.easeTo({
      center: [items[0].lng, items[0].lat],
      zoom: 12,
      duration: 500,
    });
    return;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const pad = isMobile ? 40 : 90;

  map.fitBounds(bounds, {
    padding: { top: pad, right: pad, bottom: pad, left: pad },
    duration: 500,
  });
}

function bearingFromTo(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function fitMapToUserAndSelectedStop(
  map: mapboxgl.Map,
  userLocation: { lat: number; lng: number },
  selectedStop: { lat: number; lng: number },
  options?: {
    navigationCamera?: boolean;
    /** When stale (e.g. GPS tick), skip follow-up easeTo */
    isCurrentFrame?: () => boolean;
  }
) {
  const bounds = new mapboxgl.LngLatBounds();
  bounds.extend([userLocation.lng, userLocation.lat]);
  bounds.extend([selectedStop.lng, selectedStop.lat]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const padding = isMobile
    ? { top: 140, right: 24, bottom: 300, left: 24 }
    : { top: 88, right: 88, bottom: 120, left: 88 };

  const navigationCamera = options?.navigationCamera ?? false;
  const isCurrentFrame = options?.isCurrentFrame;

  map.fitBounds(bounds, {
    padding,
    duration: 650,
    maxZoom: navigationCamera ? 16.4 : 14.5,
  });

  if (!navigationCamera) {
    return;
  }

  const bearing = bearingFromTo(userLocation, selectedStop);
  if (!Number.isFinite(bearing)) {
    return;
  }

  map.once('moveend', () => {
    if (isCurrentFrame && !isCurrentFrame()) {
      return;
    }
    map.easeTo({
      bearing,
      pitch: 52,
      duration: 520,
      essential: true,
    });
  });
}

function extendBoundsWithCoordinatePairs(
  bounds: mapboxgl.LngLatBounds,
  pairs: Array<[number, number] | readonly [number, number]>
) {
  pairs.forEach((pair) => {
    const [lng, lat] = pair;
    if (typeof lng === 'number' && typeof lat === 'number' && Number.isFinite(lng) && Number.isFinite(lat)) {
      bounds.extend([lng, lat]);
    }
  });
}

/**
 * Bounds for drawn route polylines (plus optional origin / user), when recentering the map.
 */
function buildRoutePolylineBounds(
  routeCoordinates: Array<[number, number]>,
  secondaryRouteCoordinates: Array<[number, number]>,
  routePaths: Array<{ coordinates: Array<[number, number]> }>,
  origin?: { lat: number; lng: number } | null,
  userLocation?: { lat: number; lng: number } | null
): mapboxgl.LngLatBounds | null {
  const bounds = new mapboxgl.LngLatBounds();
  extendBoundsWithCoordinatePairs(bounds, routeCoordinates);
  extendBoundsWithCoordinatePairs(bounds, secondaryRouteCoordinates);
  routePaths.forEach((path) => extendBoundsWithCoordinatePairs(bounds, path.coordinates));
  if (origin) {
    bounds.extend([origin.lng, origin.lat]);
  }
  if (userLocation) {
    bounds.extend([userLocation.lng, userLocation.lat]);
  }
  return bounds.isEmpty() ? null : bounds;
}

function fitMapToRouteOverlay(
  map: mapboxgl.Map,
  routeCoordinates: Array<[number, number]>,
  secondaryRouteCoordinates: Array<[number, number]>,
  routePaths: Array<{ coordinates: Array<[number, number]> }>,
  options: {
    origin?: { lat: number; lng: number } | null;
    userLocation?: { lat: number; lng: number } | null;
  }
) {
  const bounds = buildRoutePolylineBounds(
    routeCoordinates,
    secondaryRouteCoordinates,
    routePaths,
    options.origin,
    options.userLocation
  );

  if (!bounds) {
    return false;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const padding = isMobile
    ? { top: 136, right: 28, bottom: 248, left: 28 }
    : { top: 96, right: 96, bottom: 112, left: 96 };

  map.fitBounds(bounds, {
    padding,
    duration: 700,
    maxZoom: 14.25,
  });

  map.once('moveend', () => {
    map.easeTo({
      bearing: 0,
      pitch: DEFAULT_PITCH,
      duration: 480,
      essential: true,
    });
  });
  return true;
}

function fitMapToJourney(
  map: mapboxgl.Map,
  items: Array<DeliveryMapPoint & { lat: number; lng: number }>,
  options: {
    origin?: { lat: number; lng: number } | null;
    userLocation?: { lat: number; lng: number } | null;
  }
) {
  const bounds = new mapboxgl.LngLatBounds();

  if (options.origin) {
    bounds.extend([options.origin.lng, options.origin.lat]);
  }

  if (options.userLocation) {
    bounds.extend([options.userLocation.lng, options.userLocation.lat]);
  }

  items.forEach((item) => bounds.extend([item.lng, item.lat]));

  if (bounds.isEmpty()) {
    map.easeTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 500,
    });
    return;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const padding = isMobile
    ? { top: 136, right: 28, bottom: 248, left: 28 }
    : { top: 96, right: 96, bottom: 112, left: 96 };

  map.fitBounds(bounds, {
    padding,
    duration: 700,
    maxZoom: 14.25,
  });

  map.once('moveend', () => {
    map.easeTo({
      bearing: 0,
      pitch: DEFAULT_PITCH,
      duration: 480,
      essential: true,
    });
  });
}

export function DeliveriesMapboxCanvas({
  accessToken,
  styleId,
  items: rawItems,
  selectedItemId,
  onSelect,
  onOpenOperations,
  className,
  routeCoordinates: rawRouteCoordinates,
  secondaryRouteCoordinates: rawSecondaryRouteCoordinates,
  routePaths: rawRoutePaths,
  origin,
  userLocation: externalUserLocation,
  focusSelectedWithUserLocation = false,
  showUserToSelectedLine = false,
  routeDisplayMode = 'full',
  recenterToUserSignal = 0,
  recenterToRouteSignal = 0,
  defaultCenterOnUserLocation = false,
  enableInitialUserFocus = true,
  disablePopups = false,
  renderPointMarkers = true,
  hotspots: rawHotspots,
  showRegionalHotspotLayers = true,
  showHeatmap = false,
  mapVariant = 'field',
  showScaleControl = false,
  userLocationRadiusKm,
  lockToIsraelViewport = false,
  lockToUserLocationRadius = false,
  resolveUserLocation = true,
  navigationCamera = false,
}: Readonly<DeliveriesMapboxCanvasProps>) {
  const { locale } = useLocale();
  const items = useMemo(() => (Array.isArray(rawItems) ? rawItems : []), [rawItems]);
  const routeCoordinates = useMemo(
    () => (Array.isArray(rawRouteCoordinates) ? rawRouteCoordinates : []),
    [rawRouteCoordinates]
  );
  const secondaryRouteCoordinates = useMemo(
    () => (Array.isArray(rawSecondaryRouteCoordinates) ? rawSecondaryRouteCoordinates : []),
    [rawSecondaryRouteCoordinates]
  );
  const routePaths = useMemo(() => (Array.isArray(rawRoutePaths) ? rawRoutePaths : []), [rawRoutePaths]);
  const hotspots = useMemo(() => (Array.isArray(rawHotspots) ? rawHotspots : []), [rawHotspots]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const initialAccessTokenRef = useRef(accessToken);
  const initialStyleIdRef = useRef(styleId);
  const initialMapVariantRef = useRef(mapVariant);
  const initialShowScaleControlRef = useRef(showScaleControl);
  const initialLockToIsraelViewportRef = useRef(lockToIsraelViewport);
  const initialLockToUserLocationRadiusRef = useRef(lockToUserLocationRadius);
  const initialUserLocationRadiusKmRef = useRef(userLocationRadiusKm);
  const hasAppliedInitialUserFocusRef = useRef(false);
  const navigationFitGenerationRef = useRef(0);
  const [resolvedUserLocation, setResolvedUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationResolved, setLocationResolved] = useState(false);
  const [realTimeEta, setRealTimeEta] = useState<{
    duration: number;
    distance: number;
    geometry?: Array<[number, number]>;
  } | null>(null);
  const userLocation = externalUserLocation ?? resolvedUserLocation;

  useEffect(() => {
    if (!userLocation || !selectedItemId || !accessToken) {
      setRealTimeEta(null);
      return;
    }

    const selectedItem = items.find((i) => i.id === selectedItemId);
    if (!selectedItem?.lat || !selectedItem?.lng) return;

    const updateEta = async () => {
      const etaData = await fetchRealTimeEta(accessToken, userLocation, {
        lat: selectedItem.lat!,
        lng: selectedItem.lng!,
      });
      setRealTimeEta(etaData);
    };

    updateEta();
    const interval = setInterval(updateEta, 15000); // More aggressive tracking: every 15s
    return () => clearInterval(interval);
  }, [userLocation, selectedItemId, accessToken, items]);

  useEffect(() => {
    if (!resolveUserLocation) {
      setResolvedUserLocation(null);
      setLocationResolved(true);
      return;
    }

    if (externalUserLocation) {
      setLocationResolved(true);
      return;
    }

    let cancelled = false;

    const resolveLocation = async () => {
      const preciseLocation =
        typeof window !== 'undefined' ? await getUserLocation().catch(() => null) : null;

      if (cancelled) return;

      if (preciseLocation) {
        setResolvedUserLocation(preciseLocation);
        setLocationResolved(true);
        return;
      }

      try {
        const response = await fetch('/api/location/current', { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as {
          data?: { lat?: number; lng?: number } | null;
        } | null;

        if (
          !cancelled &&
          payload?.data?.lat !== undefined &&
          payload?.data?.lat !== null &&
          payload?.data?.lng !== undefined &&
          payload?.data?.lng !== null
        ) {
          setResolvedUserLocation({
            lat: payload.data.lat,
            lng: payload.data.lng,
          });
        }
      } finally {
        if (!cancelled) {
          setLocationResolved(true);
        }
      }
    };

    resolveLocation().catch(() => {
      if (!cancelled) {
        setLocationResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [externalUserLocation, resolveUserLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // HMR/StrictMode can leave stale Mapbox DOM nodes behind between mounts.
    // The container must be empty before creating a new map instance.
    container.replaceChildren();

    mapboxgl.accessToken = initialAccessTokenRef.current;

    const map = new mapboxgl.Map({
      container,
      style: getStyleUrl(initialStyleIdRef.current),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      maxBounds: ISRAEL_BOUNDS,
      cooperativeGestures: false,
      attributionControl: false,
    });

    const mapGesturesLocked =
      initialLockToIsraelViewportRef.current || initialLockToUserLocationRadiusRef.current;
    if (!mapGesturesLocked) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    }
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    if (initialShowScaleControlRef.current) {
      map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
    }
    if (initialLockToIsraelViewportRef.current || initialLockToUserLocationRadiusRef.current) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      map.keyboard.disable();
      map.boxZoom.disable();
      map.dragRotate.disable();
    }

    const resizeWhenReady = () => {
      try {
        if (!container.isConnected) return;
        map.resize();
        if (initialLockToIsraelViewportRef.current) {
          fitMapToIsraelBounds(map);
        } else if (
          initialLockToUserLocationRadiusRef.current &&
          typeof initialUserLocationRadiusKmRef.current === 'number' &&
          initialUserLocationRadiusKmRef.current > 0
        ) {
          fitMapToLocationRadius(
            map,
            getLockedRadiusCenter(null),
            initialUserLocationRadiusKmRef.current
          );
        }
      } catch {
        // Mapbox can throw if resize runs before the map canvas exists (e.g. rAF before `load`).
      }
    };
    const themeWhenReady = () => {
      applyDeliveryMapCartography(map, initialMapVariantRef.current);
    };
    map.once('load', resizeWhenReady);
    map.once('load', themeWhenReady);

    mapRef.current = map;
    const markers = markersRef.current;
    const originMarker = originMarkerRef;
    const userMarker = userMarkerRef;

    return () => {
      try {
        map.off('load', resizeWhenReady);
      } catch {
        // Map may be torn down mid-load.
      }
      try {
        map.off('load', themeWhenReady);
      } catch {
        // Map may be torn down mid-load.
      }
      try {
        markers.forEach((marker) => {
          try {
            marker.remove();
          } catch {
            // Marker DOM may already be detached (StrictMode / concurrent unmount).
          }
        });
      } finally {
        markers.clear();
      }
      try {
        originMarker.current?.remove();
      } catch {
        /* ignore */
      }
      originMarker.current = null;
      try {
        userMarker.current?.remove();
      } catch {
        /* ignore */
      }
      userMarker.current = null;
      try {
        map.remove();
      } catch {
        // Container may already be detached from the document.
      }
      try {
        if (container.isConnected) {
          container.replaceChildren();
        }
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const container = containerRef.current;
    if (!container || !mapRef.current) return;

    const resizeMap = () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      try {
        currentMap.resize();
        if (lockToIsraelViewport) {
          fitMapToIsraelBounds(currentMap);
          return;
        }
        if (
          lockToUserLocationRadius &&
          typeof userLocationRadiusKm === 'number' &&
          userLocationRadiusKm > 0
        ) {
          fitMapToLocationRadius(
            currentMap,
            getLockedRadiusCenter(userLocation),
            userLocationRadiusKm
          );
          return;
        }
        if (
          userLocation &&
          !selectedItemId &&
          typeof userLocationRadiusKm === 'number' &&
          userLocationRadiusKm > 0
        ) {
          fitMapToLocationRadius(currentMap, userLocation, userLocationRadiusKm);
        }
      } catch {
        // Map instance may be destroyed while ResizeObserver still fires.
      }
    };

    resizeMap();

    const observer = new ResizeObserver(() => {
      resizeMap();
    });

    observer.observe(container);
    window.addEventListener('orientationchange', resizeMap);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', resizeMap);
    };
  }, [lockToIsraelViewport, lockToUserLocationRadius, selectedItemId, userLocation, userLocationRadiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const renderTheme = () => {
      if (!map.isStyleLoaded()) {
        return;
      }
      applyDeliveryMapCartography(map, mapVariant);
    };

    renderTheme();
    map.on('style.load', renderTheme);

    return () => {
      map.off('style.load', renderTheme);
    };
  }, [mapVariant, styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const heatSourceId = 'ordex-deliveries-heat-points';
    const heatLayerId = 'ordex-deliveries-heat-layer';
    const hotspotsSourceId = 'ordex-deliveries-hotspots';
    const hotspotsLayerId = 'ordex-deliveries-hotspots-layer';
    const hotspotLabelsLayerId = 'ordex-deliveries-hotspots-labels';
    const readySourceId = 'ordex-deliveries-ready-points';
    const readyHaloLayerId = 'ordex-deliveries-ready-points-halo';
    const readyLayerId = 'ordex-deliveries-ready-points-layer';
    const hasLiveStyle = () => {
      try {
        return Boolean(map.getStyle());
      } catch {
        return false;
      }
    };
    const hasLayer = (layerId: string) => {
      if (!hasLiveStyle()) {
        return false;
      }

      try {
        return Boolean(map.getLayer(layerId));
      } catch {
        return false;
      }
    };
    const hasSource = (sourceId: string) => {
      if (!hasLiveStyle()) {
        return false;
      }

      try {
        return Boolean(map.getSource(sourceId));
      } catch {
        return false;
      }
    };
    const removeLayerIfExists = (layerId: string) => {
      if (!hasLayer(layerId)) {
        return;
      }

      try {
        map.removeLayer(layerId);
      } catch {
        // Style may be mid-teardown.
      }
    };
    const removeSourceIfExists = (sourceId: string) => {
      if (!hasSource(sourceId)) {
        return;
      }

      try {
        map.removeSource(sourceId);
      } catch {
        // Style may be mid-teardown.
      }
    };

    const cleanup = () => {
      removeLayerIfExists(readyLayerId);
      removeLayerIfExists(readyHaloLayerId);
      removeLayerIfExists(hotspotLabelsLayerId);
      removeLayerIfExists(hotspotsLayerId);
      removeLayerIfExists(heatLayerId);
      removeSourceIfExists(readySourceId);
      removeSourceIfExists(hotspotsSourceId);
      removeSourceIfExists(heatSourceId);
    };

    const renderHeatmap = () => {
      if (!hasLiveStyle() || !map.isStyleLoaded()) {
        return;
      }

      cleanup();

      if (!showHeatmap) {
        return;
      }

      const heatmapData = buildHeatmapFeatureCollection(items);
      const hotspotsData = buildHotspotsFeatureCollection(hotspots);
      const readyShipmentData = buildReadyShipmentFeatureCollection(items);
      const firstSymbolLayerId = map
        .getStyle()
        ?.layers?.find((layer) => layer.type === 'symbol' && !layer.id.startsWith('ordex-'))?.id;

      if (!heatmapData.features.length) {
        return;
      }

      map.addSource(heatSourceId, {
        type: 'geojson',
        data: heatmapData,
      });

      map.addLayer({
        id: heatLayerId,
        type: 'heatmap',
        source: heatSourceId,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            mapVariant === 'dashboard' ? 0.76 : 0.58,
            12,
            mapVariant === 'dashboard' ? 1.26 : 0.96,
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            mapVariant === 'dashboard' ? 16 : 13,
            12,
            mapVariant === 'dashboard' ? 30 : 24,
            15,
            mapVariant === 'dashboard' ? 38 : 30,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            mapVariant === 'dashboard' ? 0.44 : 0.26,
            12,
            mapVariant === 'dashboard' ? 0.26 : 0.16,
            15,
            mapVariant === 'dashboard' ? 0.12 : 0.08,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(11,132,255,0)',
            0.2,
            'rgba(11,132,255,0.18)',
            0.4,
            'rgba(6,182,212,0.3)',
            0.6,
            'rgba(56,189,248,0.38)',
            0.8,
            'rgba(249,115,22,0.46)',
            1,
            'rgba(239,68,68,0.62)',
          ],
        },
      }, firstSymbolLayerId);

      if (!showRegionalHotspotLayers || !hotspotsData.features.length) {
        return;
      }

      map.addSource(hotspotsSourceId, {
        type: 'geojson',
        data: hotspotsData,
      });

      const hotspotMinZoom = mapVariant === 'dashboard' ? 6.2 : 8.5;
      const hotspotLabelMinZoom = mapVariant === 'dashboard' ? 6.8 : 9.75;
      const stopsSuffix = translate('ui', 'maps.hotspotStopsSuffix', undefined, { locale });

      map.addLayer({
        id: hotspotsLayerId,
        type: 'circle',
        source: hotspotsSourceId,
        minzoom: hotspotMinZoom,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hotspotMinZoom,
            ['*', ['get', 'radius'], mapVariant === 'dashboard' ? 0.58 : 0.48],
            12,
            ['*', ['get', 'radius'], 0.82],
            15,
            ['*', ['get', 'radius'], 1.12],
          ],
          'circle-opacity': 0.12,
          'circle-stroke-width': 1.25,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.28,
        },
      }, firstSymbolLayerId);

      map.addLayer({
        id: hotspotLabelsLayerId,
        type: 'symbol',
        source: hotspotsSourceId,
        minzoom: hotspotLabelMinZoom,
        layout: {
          'text-field': [
            'concat',
            ['get', 'label'],
            '\n',
            ['to-string', ['get', 'count']],
            stopsSuffix,
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            hotspotLabelMinZoom,
            mapVariant === 'dashboard' ? 9 : 10,
            13,
            mapVariant === 'dashboard' ? 11 : 12,
          ],
          'text-anchor': mapVariant === 'dashboard' ? 'center' : 'top',
          'text-offset': mapVariant === 'dashboard' ? [0, 0] : [0, 1.3],
          ...(mapVariant === 'dashboard'
            ? {
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
                'text-radial-offset': 1,
                'text-max-width': 8,
                'text-padding': 4,
              }
            : {
                'text-max-width': 10,
                'text-padding': 2,
              }),
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'rgba(255,255,255,0.98)',
          'text-halo-width': mapVariant === 'dashboard' ? 2 : 1.5,
          'text-halo-blur': mapVariant === 'dashboard' ? 0.6 : 0.2,
          'text-opacity': mapVariant === 'dashboard' ? 0.96 : 0.92,
        },
      });

      if (mapVariant !== 'dashboard' || !readyShipmentData.features.length) {
        return;
      }

      map.addSource(readySourceId, {
        type: 'geojson',
        data: readyShipmentData,
      });

      map.addLayer({
        id: readyHaloLayerId,
        type: 'circle',
        source: readySourceId,
        minzoom: 5.8,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5.8,
            8,
            10,
            12,
            14,
            16,
          ],
          'circle-color': 'rgba(245, 158, 11, 0.18)',
          'circle-opacity': 0.9,
        },
      }, firstSymbolLayerId);

      map.addLayer({
        id: readyLayerId,
        type: 'circle',
        source: readySourceId,
        minzoom: 5.8,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5.8,
            4.8,
            10,
            6.5,
            14,
            8.5,
          ],
          'circle-color': '#f59e0b',
          'circle-stroke-color': '#fff7ed',
          'circle-stroke-width': 2,
          'circle-opacity': 0.96,
        },
      }, firstSymbolLayerId);
    };

    renderHeatmap();
    map.on('style.load', renderHeatmap);

    return () => {
      try {
        map.off('style.load', renderHeatmap);
      } catch {
        // Mapbox can tear down the style before effect cleanup during HMR/unmount.
      }
      cleanup();
    };
  }, [hotspots, items, locale, mapVariant, showHeatmap, showRegionalHotspotLayers, styleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const removeRouteLayer = (layerId: string, sourceId: string) => {
      if (map.getLayer(`${layerId}-casing`)) {
        map.removeLayer(`${layerId}-casing`);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };

    const renderRoute = () => {
      const selectedStopForUserLine =
        showUserToSelectedLine && userLocation && selectedItemId
          ? items.find(
              (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
                item.id === selectedItemId &&
                typeof item.lat === 'number' &&
                typeof item.lng === 'number'
            )
          : null;

      const navLegOnly = routeDisplayMode === 'selected-only' && mapVariant === 'field';

      const routeLayers =
        routeDisplayMode === 'selected-only'
          ? [
              {
                sourceId: 'ordex-deliveries-user-selected-route',
                layerId: 'ordex-deliveries-user-selected-route-line',
                coordinates:
                  realTimeEta?.geometry ??
                  (selectedStopForUserLine && userLocation
                    ? [
                        [userLocation.lat, userLocation.lng] as [number, number],
                        [selectedStopForUserLine.lat, selectedStopForUserLine.lng] as [
                          number,
                          number,
                        ],
                      ]
                    : undefined),
                color: '#0ea5e9',
                dasharray: undefined as number[] | undefined,
              },
            ]
          : routePaths?.length
            ? routePaths.map((path) => ({
                sourceId: `ordex-deliveries-route-${path.id}`,
                layerId: `ordex-deliveries-route-line-${path.id}`,
                coordinates: path.coordinates,
                color: path.color ?? PRIMARY_HEX_500,
                dasharray: path.dasharray,
              }))
            : [
                {
                  sourceId: 'ordex-deliveries-route',
                  layerId: 'ordex-deliveries-route-line',
                  coordinates: routeCoordinates,
                  color: mapVariant === 'dashboard' ? PRIMARY_HEX_500 : '#0b84ff',
                  dasharray: undefined as number[] | undefined,
                },
                {
                  sourceId: 'ordex-deliveries-secondary-route',
                  layerId: 'ordex-deliveries-secondary-route-line',
                  coordinates: secondaryRouteCoordinates,
                  color: mapVariant === 'dashboard' ? '#ff8a00' : '#fb923c',
                  dasharray: [1.5, 1.25],
                },
                {
                  sourceId: 'ordex-deliveries-user-selected-route',
                  layerId: 'ordex-deliveries-user-selected-route-line',
                  coordinates:
                    realTimeEta?.geometry ??
                    (selectedStopForUserLine && userLocation
                      ? [
                          [userLocation.lat, userLocation.lng] as [number, number],
                          [selectedStopForUserLine.lat, selectedStopForUserLine.lng] as [
                            number,
                            number,
                          ],
                        ]
                      : undefined),
                  color: mapVariant === 'dashboard' ? '#0ea5e9' : '#2563eb',
                  dasharray: realTimeEta?.geometry ? undefined : [0.6, 1.2],
                },
              ];

      removeRouteLayer('ordex-deliveries-route-line', 'ordex-deliveries-route');
      removeRouteLayer('ordex-deliveries-secondary-route-line', 'ordex-deliveries-secondary-route');
      removeRouteLayer(
        'ordex-deliveries-user-selected-route-line',
        'ordex-deliveries-user-selected-route'
      );
      routeLayers.forEach(({ layerId, sourceId }) => removeRouteLayer(layerId, sourceId));

      routeLayers.forEach(({ sourceId, layerId, coordinates, color, dasharray }) => {
        if (!coordinates?.length || coordinates.length < 2) {
          return;
        }

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates.map(([lat, lng]) => [lng, lat]),
            },
          },
        });

        map.addLayer({
          id: `${layerId}-casing`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': mapVariant === 'dashboard' ? '#0f172a' : '#082f49',
            'line-width':
              sourceId === 'ordex-deliveries-route' || sourceId.includes('group-')
                ? mapVariant === 'dashboard' ? 8 : 9
                : sourceId === 'ordex-deliveries-user-selected-route'
                  ? navLegOnly
                    ? 13
                    : mapVariant === 'dashboard'
                      ? 9
                      : 10
                  : 5,
            'line-opacity':
              sourceId === 'ordex-deliveries-user-selected-route'
                ? navLegOnly
                  ? 0.26
                  : mapVariant === 'dashboard'
                    ? 0.22
                    : 0.18
                : mapVariant === 'dashboard'
                  ? 0.14
                  : 0.12,
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width':
              sourceId === 'ordex-deliveries-route' || sourceId.includes('group-')
                ? mapVariant === 'dashboard' ? 5.5 : 6.5
                : sourceId === 'ordex-deliveries-user-selected-route'
                  ? navLegOnly
                    ? 9
                    : mapVariant === 'dashboard'
                      ? 6.5
                      : 7
                  : 4,
            'line-opacity':
              sourceId === 'ordex-deliveries-route' || sourceId.includes('group-')
                ? mapVariant === 'dashboard' ? 0.96 : 0.98
                : sourceId === 'ordex-deliveries-user-selected-route'
                  ? navLegOnly
                    ? 1
                    : mapVariant === 'dashboard'
                      ? 0.94
                      : 0.98
                  : mapVariant === 'dashboard' ? 0.74 : 0.82,
            ...(dasharray ? { 'line-dasharray': dasharray } : {}),
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        });
      });
    };

    const renderWhenStyleReady = () => {
      if (!map.isStyleLoaded()) {
        return;
      }
      renderRoute();
    };

    renderWhenStyleReady();
    map.on('style.load', renderWhenStyleReady);

    return () => {
      map.off('style.load', renderWhenStyleReady);
    };
  }, [
    items,
    mapVariant,
    realTimeEta,
    routeCoordinates,
    routeDisplayMode,
    routePaths,
    secondaryRouteCoordinates,
    selectedItemId,
    showUserToSelectedLine,
    styleId,
    userLocation,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;

    const validItems = items.filter(
      (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
        typeof item.lat === 'number' && typeof item.lng === 'number'
    );

    if (origin) {
      const originMarker = new mapboxgl.Marker({
        element: createOriginElement(),
        anchor: 'center',
      }).setLngLat([origin.lng, origin.lat]);

      if (!disablePopups) {
        const originCard = document.createElement('div');
        originCard.className = styles.popupCard;
        originCard.dir = locale === 'en' ? 'ltr' : 'rtl';
        const originTitle = document.createElement('h3');
        originTitle.className = styles.popupTitle;
        originTitle.textContent = translate('ui', 'maps.origin.title', undefined, { locale });
        const originDesc = document.createElement('p');
        originDesc.className = styles.popupDescription;
        originDesc.textContent = translate('ui', 'maps.origin.description', undefined, { locale });
        originCard.appendChild(originTitle);
        originCard.appendChild(originDesc);
        originMarker.setPopup(
          new mapboxgl.Popup({ offset: 18, className: 'ordex-mapbox-popup' }).setDOMContent(originCard)
        );
      }

      originMarkerRef.current = originMarker.addTo(map);
    }

    if (!renderPointMarkers) {
      return;
    }

    validItems.forEach((item) => {
      const isSelected = item.id === selectedItemId;
      const marker = new mapboxgl.Marker({
        element: createCustomerMarkerElement(item, isSelected, mapVariant, locale),
        scale: 1,
        anchor: 'bottom',
      }).setLngLat([item.lng, item.lat]);

      if (!disablePopups) {
        const popup = new mapboxgl.Popup({
          offset: 25,
          className: 'ordex-mapbox-popup',
        }).setDOMContent(
          buildPopupContent(
            {
              ...item,
              etaMinutes: isSelected && realTimeEta ? realTimeEta.duration : item.etaMinutes,
              distanceKm: isSelected && realTimeEta ? realTimeEta.distance : item.distanceKm,
            },
            { onSelect, onOpenOperations },
            locale
          )
        );
        marker.setPopup(popup);
      }

      marker.addTo(map);

      marker.getElement().classList.add(styles.mapboxPin);
      if (isSelected) {
        marker.getElement().classList.add(styles.mapboxPinSelected);
      }
      marker
        .getElement()
        .setAttribute('aria-label', `${item.customerName}, ${getMarkerRouteCaption(item, locale)}`);
      marker.getElement().addEventListener('click', () => onSelect?.(item.id));
      markersRef.current.set(item.id, marker);
    });
  }, [
    disablePopups,
    items,
    locale,
    mapVariant,
    onOpenOperations,
    onSelect,
    origin,
    renderPointMarkers,
    selectedItemId,
    realTimeEta,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userLocation) {
      return;
    }

    const userMarker = new mapboxgl.Marker({
      element: createUserLocationElement(),
      anchor: 'center',
    }).setLngLat([userLocation.lng, userLocation.lat]);

    if (!disablePopups) {
      const userCard = document.createElement('div');
      userCard.className = styles.popupCard;
      userCard.dir = locale === 'en' ? 'ltr' : 'rtl';
      const userTitle = document.createElement('h3');
      userTitle.className = styles.popupTitle;
      userTitle.textContent = translate('ui', 'maps.userLocation.title', undefined, { locale });
      const userDesc = document.createElement('p');
      userDesc.className = styles.popupDescription;
      userDesc.textContent = translate('ui', 'maps.userLocation.description', undefined, { locale });
      userCard.appendChild(userTitle);
      userCard.appendChild(userDesc);
      userMarker.setPopup(
        new mapboxgl.Popup({ offset: 18, className: 'ordex-mapbox-popup' }).setDOMContent(userCard)
      );
    }

    userMarkerRef.current = userMarker.addTo(map);
  }, [disablePopups, locale, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedItemId) return;

    if (lockToIsraelViewport) {
      fitMapToIsraelBounds(map);
      return;
    }
    if (lockToUserLocationRadius && typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, getLockedRadiusCenter(userLocation), userLocationRadiusKm);
      return;
    }

    const validItems = items.filter(
      (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
        typeof item.lat === 'number' && typeof item.lng === 'number'
    );

    if (userLocation) {
      if (typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
        fitMapToLocationRadius(map, userLocation, userLocationRadiusKm);
      } else {
        focusMapOnCurrentLocation(map, userLocation);
      }
      return;
    }

    if (!locationResolved) {
      return;
    }

    fitMapToPoints(map, validItems, origin);
  }, [items, locationResolved, lockToIsraelViewport, lockToUserLocationRadius, origin, selectedItemId, userLocation, userLocationRadiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedItemId) return;

    if (lockToIsraelViewport) {
      fitMapToIsraelBounds(map);
      return;
    }
    if (lockToUserLocationRadius && typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, getLockedRadiusCenter(userLocation), userLocationRadiusKm);
      return;
    }

    if (
      defaultCenterOnUserLocation &&
      enableInitialUserFocus &&
      userLocation &&
      !hasAppliedInitialUserFocusRef.current
    ) {
      return;
    }

    const selectedItem = items.find(
      (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
        item.id === selectedItemId && typeof item.lat === 'number' && typeof item.lng === 'number'
    );

    if (!selectedItem) return;

    if (focusSelectedWithUserLocation && userLocation) {
      navigationFitGenerationRef.current += 1;
      const generation = navigationFitGenerationRef.current;
      fitMapToUserAndSelectedStop(map, userLocation, selectedItem, {
        navigationCamera,
        isCurrentFrame: () => navigationFitGenerationRef.current === generation,
      });
    } else {
      map.easeTo({
        center: [selectedItem.lng, selectedItem.lat],
        zoom: Math.max(map.getZoom(), 11),
        duration: 500,
      });
    }

    if (!disablePopups) {
      markersRef.current.get(selectedItemId)?.togglePopup();
    }
  }, [
    disablePopups,
    defaultCenterOnUserLocation,
    enableInitialUserFocus,
    focusSelectedWithUserLocation,
    items,
    lockToIsraelViewport,
    lockToUserLocationRadius,
    navigationCamera,
    selectedItemId,
    userLocation,
    userLocationRadiusKm,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !defaultCenterOnUserLocation ||
      !enableInitialUserFocus ||
      !userLocation ||
      hasAppliedInitialUserFocusRef.current
    ) {
      return;
    }

    if (lockToIsraelViewport) {
      fitMapToIsraelBounds(map);
      hasAppliedInitialUserFocusRef.current = true;
      return;
    }
    if (lockToUserLocationRadius && typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, getLockedRadiusCenter(userLocation), userLocationRadiusKm);
      hasAppliedInitialUserFocusRef.current = true;
      return;
    }

    if (typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, userLocation, userLocationRadiusKm);
    } else {
      focusMapOnCurrentLocation(map, userLocation, 14.5);
    }
    hasAppliedInitialUserFocusRef.current = true;
  }, [defaultCenterOnUserLocation, enableInitialUserFocus, lockToIsraelViewport, lockToUserLocationRadius, userLocation, userLocationRadiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || recenterToUserSignal === 0) return;

    if (lockToIsraelViewport) {
      fitMapToIsraelBounds(map);
      return;
    }
    if (lockToUserLocationRadius && typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, getLockedRadiusCenter(userLocation), userLocationRadiusKm);
      return;
    }

    if (typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, userLocation, userLocationRadiusKm);
    } else {
      focusMapOnCurrentLocation(map, userLocation, 14.5);
    }
  }, [lockToIsraelViewport, lockToUserLocationRadius, recenterToUserSignal, userLocation, userLocationRadiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterToRouteSignal === 0) return;

    if (lockToIsraelViewport) {
      fitMapToIsraelBounds(map);
      return;
    }
    if (lockToUserLocationRadius && typeof userLocationRadiusKm === 'number' && userLocationRadiusKm > 0) {
      fitMapToLocationRadius(map, getLockedRadiusCenter(userLocation), userLocationRadiusKm);
      return;
    }

    const validItems = items.filter(
      (item): item is DeliveryMapPoint & { lat: number; lng: number } =>
        typeof item.lat === 'number' && typeof item.lng === 'number'
    );

    const fittedToRoute = fitMapToRouteOverlay(map, routeCoordinates, secondaryRouteCoordinates, routePaths, {
      origin,
      userLocation,
    });
    if (!fittedToRoute) {
      fitMapToJourney(map, validItems, { origin, userLocation });
    }
  }, [
    items,
    lockToIsraelViewport,
    lockToUserLocationRadius,
    origin,
    recenterToRouteSignal,
    routeCoordinates,
    routePaths,
    secondaryRouteCoordinates,
    userLocation,
    userLocationRadiusKm,
  ]);

  return (
    <div className={cn(styles.mapRoot, className)}>
      <div ref={containerRef} className={styles.mapCanvas} />
    </div>
  );
}
