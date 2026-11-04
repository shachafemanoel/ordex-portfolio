'use client';

import { EntityBadge, EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { getEntityToneDotClass } from '@/components/shared/display/displayStatus';
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DeliveriesMapboxPanel } from '@/components/ops/shared/DeliveriesMapboxPanel';
import { DeliveryRouteStaticMap } from '@/components/ops/shared/DeliveryRouteStaticMap';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { OperationalMessageKind } from '@prisma/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DeliveryRouteSessionLocation } from '@/lib/delivery-route-session';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  Clock3,
  Loader2,
  LocateFixed,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Play,
  Router,
} from 'lucide-react';

import {
  buildNavigationHref,
  buildPhoneHref,
  formatClockTime,
  formatCompactAddress,
  formatDistanceLabel,
  toStaticMapPoint,
  type DeliveryBoardItem,
  type DeliveryRouteGroupView,
} from './types';

interface FieldExecutionScreenProps {
  activeRouteGroup: DeliveryRouteGroupView | null;
  activeRouteCountLabel: string;
  activeRouteDurationLabel: string | null;
  activeRouteDistanceLabel: string | null;
  activeRouteCompletedCount: number;
  activeRouteTotalItemsCount: number;
  currentUserName: string | null;
  executionFollowingDelivery: DeliveryBoardItem | null;
  executionNextArrived: boolean;
  executionNextDeferred: boolean;
  executionNextDelivery: DeliveryBoardItem | null;
  executionProgressPercent: number;
  executionQueuedDeliveries: DeliveryBoardItem[];
  executionRemainingStops: DeliveryBoardItem[];
  isExecutionMode: boolean;
  isMutating: boolean;
  liveLocation: DeliveryRouteSessionLocation | null;
  mapboxAccessToken: string;
  mapboxStyleId: string;
  onCompleteNextStop: () => void;
  onDeferNextStop: (reason: 'WAITING_CUSTOMER' | 'MISSING_DETAILS') => void;
  onMarkArrival: () => void;
  onOpenOrder: () => void;
  onReleaseExecution: () => void;
  origin: { lat: number; lng: number } | null;
  originTimelineLabel: string;
  routeCoordinates: Array<[number, number]>;
  trackingStatus: 'idle' | 'watching' | 'denied' | 'unsupported';
}

type ActionSheetSnap = 'collapsed' | 'half' | 'expanded';

function getTrackingLabel(
  trackingStatus: FieldExecutionScreenProps['trackingStatus'],
  liveLocation: DeliveryRouteSessionLocation | null
) {
  if (trackingStatus === 'watching') {
    return liveLocation?.recordedAt
      ? `מיקום חי • ${formatClockTime(liveLocation.recordedAt) ?? 'עודכן עכשיו'}`
      : 'מיקום חי פעיל';
  }
  if (trackingStatus === 'denied') return 'אין הרשאת מיקום';
  if (trackingStatus === 'unsupported') return 'מעקב מיקום לא נתמך';
  if (liveLocation?.recordedAt) {
    return `מיקום שמור • ${formatClockTime(liveLocation.recordedAt) ?? 'עודכן'}`;
  }
  return 'מיקום יסתנכרן עם תחילת התנועה';
}

function formatItemsLabel(item: DeliveryBoardItem | null) {
  if (!item) return null;

  if (item.itemsSummary?.trim()) {
    return item.itemsSummary.trim();
  }

  if (typeof item.itemsCount === 'number' && item.itemsCount > 0) {
    return `${item.itemsCount} פריטים להזזה ולהתקנה`;
  }

  return null;
}

export function FieldExecutionScreen(props: Readonly<FieldExecutionScreenProps>) {
  const { t } = useUITranslation();
  const { success, error } = useToast();
  const [waSending, setWaSending] = useState(false);
  const [actionSheetSnap, setActionSheetSnap] = useState<ActionSheetSnap>('collapsed');
  const [recenterToUserSignal, setRecenterToUserSignal] = useState(0);
  const [recenterToRouteSignal, setRecenterToRouteSignal] = useState(0);
  const [isPageFullyLoaded, setIsPageFullyLoaded] = useState(false);
  const actionSheetRef = useRef<HTMLDivElement | null>(null);
  const actionSheetPeekRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();
  const actionSheetY = useMotionValue(0);
  const [actionSheetHeights, setActionSheetHeights] = useState({ full: 0, peek: 0 });
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportHeight(window.innerHeight);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const executionNextNavigationHref = props.executionNextDelivery
    ? buildNavigationHref(props.executionNextDelivery)
    : null;
  const executionNextPhoneHref = buildPhoneHref(props.executionNextDelivery?.customerPhone ?? null);
  const trackingLabel = getTrackingLabel(props.trackingStatus, props.liveLocation);
  const hasNextDelivery = Boolean(props.executionNextDelivery);
  const hasInteractiveMap = Boolean(props.mapboxAccessToken && props.mapboxStyleId);
  const etaLabel =
    formatClockTime(props.executionNextDelivery?.estimatedArrivalAt) ??
    formatClockTime(props.executionNextDelivery?.scheduledAt);
  const nextStopDistanceLabel = formatDistanceLabel(
    props.executionNextDelivery?.distanceKm ?? null
  );
  const nextStopAddress = props.executionNextDelivery
    ? formatCompactAddress(
        props.executionNextDelivery.addressLine,
        props.executionNextDelivery.city
      )
    : null;
  const nextStopItemsLabel = formatItemsLabel(props.executionNextDelivery);
  const sendCourierEtaWhatsApp = async () => {
    const d = props.executionNextDelivery;
    if (!d?.id) return;
    setWaSending(true);
    try {
      const idem =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const arrivalIso = d.estimatedArrivalAt?.trim() || null;
      const res = await apiClient(`/api/orders/${d.id}/operational-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idem,
        },
        body: JSON.stringify({
          operationalKind: OperationalMessageKind.DELIVERY_COURIER_ETA,
          mode: 'db_text',
          etaMinutes: d.etaMinutes ?? null,
          estimatedArrivalAt: arrivalIso,
          courierName: props.currentUserName ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          j?.error?.message || (typeof j?.detail === 'string' ? j.detail : 'שליחה נכשלה')
        );
      }
      success('עדכון וואטסאפ נשלח ללקוח');
    } catch (e) {
      error(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setWaSending(false);
    }
  };
  const followingStopLabel = props.executionFollowingDelivery
    ? `${props.executionFollowingDelivery.customerName}${
        props.executionQueuedDeliveries.length > 1
          ? ` • ועוד ${props.executionQueuedDeliveries.length - 1} בהמשך`
          : ''
      }`
    : null;
  const queuedPreviewDeliveries = props.executionQueuedDeliveries.slice(0, 3);
  const stageLabel = props.executionNextArrived ? 'באתר' : 'בדרך ליעד';
  const currentTaskLabel = props.executionNextArrived ? 'פריקה והתקנה' : 'נסיעה ותיאום הגעה';
  const currentTaskHint = props.executionNextArrived
    ? 'בדוק פריטים, בצע התקנה, ורק אז סמן סיום.'
    : props.executionNextDeferred
      ? 'העצירה נדחתה. אמת עם הלקוח לפני הגעה מחודשת.'
      : 'נווט ליעד, התקשר במידת הצורך, והכן פריקה.';
  const payloadLabel = nextStopItemsLabel ?? 'אין פירוט פריטים זמין';
  const summaryStatusLabel =
    actionSheetSnap === 'expanded'
      ? 'פתוח מלא'
      : actionSheetSnap === 'half'
        ? 'חצי פתוח'
        : 'לחץ לפתיחה';
  const summaryStatusBadgeClassName =
    actionSheetSnap === 'expanded'
      ? getEntityToneDotClass('accent')
      : actionSheetSnap === 'half'
        ? getEntityToneDotClass('info')
        : getEntityToneDotClass('neutral');
  const trackingBadgeTone =
    props.trackingStatus === 'watching'
      ? 'success'
      : props.trackingStatus === 'denied' || props.trackingStatus === 'unsupported'
        ? 'warning'
        : 'neutral';
  const collapsedActionSheetOffset = useMemo(() => {
    if (!viewportHeight || !actionSheetHeights.full) {
      return Math.max(0, actionSheetHeights.full - actionSheetHeights.peek);
    }
    // We want 22% of the screen to be visible in collapsed mode
    const desiredVisibleHeight = viewportHeight * 0.22;
    const minVisibleHeight = Math.max(desiredVisibleHeight, actionSheetHeights.peek);
    return Math.max(0, actionSheetHeights.full - minVisibleHeight);
  }, [actionSheetHeights.full, actionSheetHeights.peek, viewportHeight]);

  const contextualHalfVisibleHeight = useMemo(() => {
    if (!viewportHeight || !actionSheetHeights.full) return 320;

    const drivingVisibleHeight = viewportHeight * 0.45;
    const onSiteVisibleHeight = viewportHeight * 0.65;
    const notesBoost = props.executionNextDelivery?.notes ? 52 : 0;
    const deferredBoost = props.executionNextDeferred ? 28 : 0;

    return Math.min(
      actionSheetHeights.full,
      actionSheetHeights.peek +
        (props.executionNextArrived ? onSiteVisibleHeight : drivingVisibleHeight) +
        notesBoost +
        deferredBoost
    );
  }, [
    actionSheetHeights.full,
    actionSheetHeights.peek,
    props.executionNextArrived,
    props.executionNextDeferred,
    props.executionNextDelivery?.notes,
    viewportHeight,
  ]);
  const halfActionSheetOffset = useMemo(
    () => Math.max(0, actionSheetHeights.full - contextualHalfVisibleHeight),
    [actionSheetHeights.full, contextualHalfVisibleHeight]
  );
  const routeMapItems = props.executionRemainingStops.map((item) => ({
    id: item.id,
    number: item.number,
    customerName: item.customerName,
    status: item.status,
    addressLine: item.addressLine,
    city: item.city,
    scheduledAt: item.scheduledAt,
    lat: item.lat,
    lng: item.lng,
    etaMinutes: item.etaMinutes,
    distanceKm: item.distanceKm,
    routeIndex: item.routeIndex,
    estimatedArrivalAt: item.estimatedArrivalAt,
    estimatedCompletionAt: item.estimatedCompletionAt,
    geocodeSource: item.geocodeSource,
    routeBucket: item.routeBucket,
    autoDeferredToDate: item.autoDeferredToDate,
    groupId: item.groupId ?? props.activeRouteGroup?.id ?? null,
    groupLabel: item.groupLabel ?? props.activeRouteGroup?.label ?? null,
    groupColor: item.groupColor ?? props.activeRouteGroup?.color ?? null,
    workerIndex: item.workerIndex ?? props.activeRouteGroup?.workerIndex ?? null,
  }));
  const routePaths =
    props.activeRouteGroup && props.routeCoordinates.length >= 2
      ? [
          {
            id: props.activeRouteGroup.id,
            coordinates: props.routeCoordinates,
            color: props.activeRouteGroup.color,
          },
        ]
      : undefined;

  /** מיקום חי + עצירה הבאה → מפת מקטע נסיעה (כמו ניווט) במקום כל המסלול */
  const useNavigationLegMap = Boolean(props.liveLocation && props.executionNextDelivery);

  const nextStopMapInsight: import('@/lib/delivery-map-insights').DeliveryMapInsight | null = props.executionNextDelivery
    ? {
        id: 'next-stop',
        label: 'עצירה הבאה',
        value: [
          props.executionNextDelivery.customerName,
          etaLabel ? `ETA ${etaLabel}` : null,
          nextStopDistanceLabel,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' • '),
        tone: props.executionNextDeferred
          ? 'warning'
          : props.executionNextArrived
            ? 'success'
            : 'info',
      }
    : null;
  const mapInsights = useMemo(() => {
    if (!props.isExecutionMode) {
      return [];
    }
    return nextStopMapInsight ? [nextStopMapInsight] : [];
  }, [nextStopMapInsight, props.isExecutionMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (document.readyState === 'complete') {
      setIsPageFullyLoaded(true);
      return;
    }

    const handleLoad = () => {
      setIsPageFullyLoaded(true);
    };

    window.addEventListener('load', handleLoad, { once: true });
    return () => {
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    setActionSheetSnap('collapsed');
  }, [props.executionNextDelivery?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fullElement = actionSheetRef.current;
    const peekElement = actionSheetPeekRef.current;
    if (!fullElement || !peekElement) return;

    const updateHeights = () => {
      setActionSheetHeights({
        full: fullElement.offsetHeight,
        peek: peekElement.offsetHeight,
      });
    };

    updateHeights();

    const observer = new ResizeObserver(() => {
      updateHeights();
    });

    observer.observe(fullElement);
    observer.observe(peekElement);

    return () => {
      observer.disconnect();
    };
  }, [actionSheetSnap, hasNextDelivery, props.executionNextDelivery?.id]);

  useEffect(() => {
    const target =
      actionSheetSnap === 'expanded'
        ? 0
        : actionSheetSnap === 'half'
          ? halfActionSheetOffset
          : collapsedActionSheetOffset;
    const controls = animate(actionSheetY, target, {
      type: 'spring',
      stiffness: 340,
      damping: 34,
      mass: 0.9,
    });

    return () => {
      controls.stop();
    };
  }, [actionSheetSnap, actionSheetY, collapsedActionSheetOffset, halfActionSheetOffset]);

  if (!props.activeRouteGroup) {
    return (
      <main className="flex min-h-[260px] flex-col items-center justify-center rounded-[28px] border border-dashed border-subtle bg-surface-translucent px-6 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-info-soft text-brand">
          <Router className="h-6 w-6" />
        </div>
        <div className="mt-4 text-xl font-black text-fg">בחר מסלול ותתחיל ממנו</div>
        <div className="mt-2 max-w-md text-sm font-semibold leading-6 text-fg-muted">
          בחר שורת אזור, סמן מה נאסף, ולחץ `אספתי`. משם המסך עובר למצב שטח ממוקד עם מפה, מיקום
          נוכחי, ופעולות מהירות לביצוע העצירה הבאה.
        </div>
      </main>
    );
  }

  if (!props.isExecutionMode) {
    return (
      <main className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-[30px]">
          {hasInteractiveMap ? (
            <DeliveriesMapboxPanel
              title=""
              subtitle=""
              mapVariant="field"
              items={routeMapItems}
              selectedItemId={null}
              compact
              className="h-[300px] sm:h-[420px]"
              mapClassName="h-full w-full rounded-none border-0"
              routeCoordinates={props.routeCoordinates}
              routePaths={routePaths}
              origin={props.origin}
              routeDisplayMode="full"
              recenterToRouteSignal={recenterToRouteSignal}
              insights={mapInsights}
              showStatOverlays={false}
              showRegionalHotspotLayers={false}
              showHeatmap={routeMapItems.length > 1}
            />
          ) : (
            <DeliveryRouteStaticMap
              accessToken={props.mapboxAccessToken}
              styleId={props.mapboxStyleId}
              origin={toStaticMapPoint(props.origin)}
              nextStop={toStaticMapPoint(props.activeRouteGroup.leadDelivery)}
              nextStopLabel={
                typeof props.activeRouteGroup.leadDelivery?.routeIndex === 'number'
                  ? String(props.activeRouteGroup.leadDelivery.routeIndex)
                  : null
              }
              routeCoordinates={props.routeCoordinates}
              fallbackPoints={[
                ...(props.origin ? [props.origin] : []),
                ...props.executionRemainingStops
                  .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
                  .map((item) => ({ lat: item.lat as number, lng: item.lng as number })),
              ]}
              caption={`בדיקת איסוף לפני יציאה למסלול ${props.activeRouteGroup.label}`}
              className="rounded-[30px] h-[280px] sm:h-[360px]"
            />
          )}
          {hasInteractiveMap && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRecenterToRouteSignal((v) => v + 1)}
                  aria-label={t('maps.field.recenterRouteAria')}
                  className="absolute bottom-3 start-3 h-10 w-10 rounded-full border-subtle bg-surface-translucent-strong p-0 text-fg-muted shadow-md backdrop-blur-sm"
                >
                  <Router className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs font-semibold">
                {t('maps.field.recenterRoute')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="rounded-[28px] border border-subtle bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-black text-fg">מסלול מוכן ליציאה</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-fg-muted">
                {props.activeRouteGroup.label} • {props.activeRouteCountLabel}
              </div>
            </div>
            <div className="shrink-0 rounded-2xl bg-info-soft px-3 py-2 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-brand">
                עצירות
              </div>
              <div className="text-xl font-black text-brand-deep">
                {props.executionRemainingStops.length}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {props.activeRouteDurationLabel ? (
              <span className="rounded-full border border-subtle bg-surface-muted px-3 py-1.5 text-[11px] font-black text-fg-muted">
                {props.activeRouteDurationLabel}
              </span>
            ) : null}
            {props.activeRouteDistanceLabel ? (
              <span className="rounded-full border border-subtle bg-surface-muted px-3 py-1.5 text-[11px] font-black text-fg-muted">
                {props.activeRouteDistanceLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-primary-200 bg-info-soft px-3 py-1.5 text-[11px] font-black text-brand">
              מסלול אופטימלי
            </span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-map-shell">
      <div className="absolute inset-0">
        {hasInteractiveMap ? (
          <DeliveriesMapboxPanel
            title=""
            subtitle=""
            mapVariant="field"
            items={routeMapItems}
            selectedItemId={props.executionNextDelivery?.id ?? null}
            compact
            className="h-full"
            mapClassName="h-full w-full rounded-none border-0"
            routeCoordinates={props.routeCoordinates}
            routePaths={routePaths}
            origin={props.origin}
            userLocation={
              props.liveLocation
                ? { lat: props.liveLocation.lat, lng: props.liveLocation.lng }
                : null
            }
            focusSelectedWithUserLocation
            showUserToSelectedLine
            routeDisplayMode={useNavigationLegMap ? 'selected-only' : 'full'}
            recenterToUserSignal={recenterToUserSignal}
            recenterToRouteSignal={recenterToRouteSignal}
            defaultCenterOnUserLocation
            enableInitialUserFocus={isPageFullyLoaded}
            disablePopups
            insights={mapInsights}
            showHeatmap={false}
            navigationCamera={useNavigationLegMap}
          />
        ) : (
          <DeliveryRouteStaticMap
            accessToken={props.mapboxAccessToken}
            styleId={props.mapboxStyleId}
            origin={toStaticMapPoint(props.origin)}
            nextStop={toStaticMapPoint(props.executionNextDelivery)}
            nextStopLabel={
              typeof props.executionNextDelivery?.routeIndex === 'number'
                ? String(props.executionNextDelivery.routeIndex)
                : null
            }
            routeCoordinates={props.routeCoordinates}
            fallbackPoints={[
              ...(props.origin ? [props.origin] : []),
              ...props.executionRemainingStops
                .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
                .map((item) => ({ lat: item.lat as number, lng: item.lng as number })),
            ]}
            caption={
              props.executionNextDelivery
                ? `עצירה הבאה: ${props.executionNextDelivery.customerName}`
                : 'כל העצירות במסלול הושלמו'
            }
            className="h-full rounded-none"
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 vignette-map-top" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 vignette-map-bottom" />

      <div className="absolute inset-x-0 top-0 z-20 px-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:px-6 sm:pt-6">
        <EntitySurface className="pointer-events-auto mx-auto max-w-[1400px] rounded-full border-surface-soft bg-surface-translucent-strong px-4 py-2 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                type="button"
                variant="outline"
                onClick={props.onReleaseExecution}
                className="h-10 w-10 shrink-0 rounded-full border-subtle bg-surface p-0 text-fg shadow-sm"
              >
                <ChevronUp className="-rotate-90 h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-fg">
                  {props.executionNextDelivery?.customerName ?? props.activeRouteGroup.label}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-fg-muted">
                  <span>
                    {props.activeRouteCompletedCount}/{props.activeRouteGroup.items.length} הושלמו
                  </span>
                  <span className="h-1 w-1 rounded-full bg-dot-muted" />
                  <span className="text-brand">{props.executionProgressPercent}%</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-1.5 sm:flex ml-2">
                <EntityBadge
                  label={stageLabel}
                  tone={props.executionNextArrived ? 'success' : 'info'}
                  className="h-7"
                />
                {etaLabel && <EntityBadge label={`ETA ${etaLabel}`} tone="info" className="h-7" />}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecenterToRouteSignal((value) => value + 1)}
                    aria-label={t('maps.field.recenterRouteAria')}
                    className="h-10 w-10 rounded-full border-subtle bg-surface p-0 text-fg-muted shadow-sm"
                  >
                    <Router className="h-4.5 w-4.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-semibold">
                  {t('maps.field.fullRouteTooltip')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRecenterToUserSignal((value) => value + 1)}
                    aria-label={t('maps.field.myLocationAria')}
                    className="h-10 w-10 rounded-full border-subtle bg-surface p-0 text-brand-deep shadow-sm"
                  >
                    <LocateFixed className="h-4.5 w-4.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-semibold">
                  {t('maps.field.myLocation')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </EntitySurface>
      </div>

      {!hasNextDelivery ? (
        <div className="absolute inset-x-4 bottom-8 z-20 mx-auto max-w-[500px] rounded-[32px] border border-surface-soft bg-surface-translucent-strong p-8 text-center shadow-[0_32px_64px_rgba(15,23,42,0.22)] backdrop-blur-3xl">
          <div className="surface-success-icon-wrap mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="mt-5 text-2xl font-black text-fg">המסלול הושלם</div>
          <div className="mt-2 text-sm font-semibold text-fg-muted">
            כל {props.activeRouteCompletedCount} העצירות במסלול בוצעו בהצלחה.
          </div>
          <Button
            type="button"
            variant="default"
            onClick={props.onReleaseExecution}
            className="mt-7 h-12 w-full rounded-2xl bg-inverse-strip px-5 font-black text-on-dark hover:bg-inverse-deep"
          >
            חזרה ללוח המשלוחים
          </Button>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 sm:px-6 sm:pb-8">
          <motion.div
            ref={actionSheetRef}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: collapsedActionSheetOffset }}
            dragElastic={0.08}
            style={{ y: actionSheetY }}
            onDragEnd={(_, info) => {
              const projectedY = Math.min(
                collapsedActionSheetOffset,
                Math.max(0, actionSheetY.get() + info.velocity.y * 0.14)
              );
              const snapPoints: Array<{ snap: ActionSheetSnap; offset: number }> = [
                { snap: 'expanded', offset: 0 },
                { snap: 'half', offset: halfActionSheetOffset },
                { snap: 'collapsed', offset: collapsedActionSheetOffset },
              ];

              const nearestSnap = snapPoints.reduce((closest, current) =>
                Math.abs(current.offset - projectedY) < Math.abs(closest.offset - projectedY)
                  ? current
                  : closest
              );

              setActionSheetSnap(nearestSnap.snap);
            }}
            className="mx-auto max-w-[820px] pointer-events-auto overflow-hidden rounded-[32px] border border-surface-strong bg-surface-translucent-strong shadow-[0_32px_64px_rgba(15,23,42,0.25)] backdrop-blur-3xl sm:rounded-[40px]"
          >
            <div ref={actionSheetPeekRef}>
              <div
                className="cursor-grab touch-none px-3 pt-2.5 active:cursor-grabbing sm:px-4"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <div className="bg-pull-bar mx-auto h-1.5 w-14 rounded-full" />
              </div>

              <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setActionSheetSnap((value) => (value === 'collapsed' ? 'half' : 'collapsed'))
                    }
                    className="min-w-0 flex-1 text-right"
                    aria-expanded={actionSheetSnap !== 'collapsed'}
                  >
                    <div className="truncate text-lg font-black text-fg sm:text-xl">
                      {props.executionNextDelivery?.customerName}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] font-semibold text-fg-muted sm:text-sm">
                      {props.executionNextDelivery?.addressLine},{' '}
                      {props.executionNextDelivery?.city}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {executionNextPhoneHref && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={props.isMutating || waSending}
                        onClick={() => void sendCourierEtaWhatsApp()}
                        className="h-12 w-12 rounded-full border-subtle bg-surface p-0 text-whatsapp shadow-sm sm:h-14 sm:w-14"
                        aria-label="שלח ללקוח עדכון וואטסאפ — שליח בדרך (לפי ETA)"
                        title="וואטסאפ: שליח בדרך + זמן משוער"
                      >
                        {waSending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                    {executionNextPhoneHref && (
                      <Button
                        asChild
                        variant="outline"
                        className="h-12 w-12 rounded-full border-subtle bg-surface p-0 text-fg-muted shadow-sm sm:h-14 sm:w-14"
                      >
                        <a href={executionNextPhoneHref} aria-label="התקשר ללקוח">
                          <Phone className="h-5 w-5" />
                        </a>
                      </Button>
                    )}
                    {executionNextNavigationHref && (
                      <a
                        href={executionNextNavigationHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-nav-cta text-on-dark shadow-md transition-transform active:scale-95 sm:h-14 sm:w-14"
                      >
                        <img
                          src="/waze-icon.svg"
                          alt="Waze"
                          className="h-6 w-6 brightness-0 invert"
                        />
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="default"
                      onClick={
                        props.executionNextArrived ? props.onCompleteNextStop : props.onMarkArrival
                      }
                      disabled={props.isMutating}
                      className={cn(
                        'h-12 rounded-full px-5 font-black text-on-dark shadow-md sm:h-14 sm:px-8',
                        props.executionNextArrived ? 'bg-success-solid' : 'bg-inverse-strip'
                      )}
                    >
                      {props.executionNextArrived ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <MapPin className="h-5 w-5" />
                      )}
                      <span className="hidden sm:inline mr-2">
                        {props.executionNextArrived ? 'סיום' : 'הגעתי'}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden border-t border-subtle-light">
              <div className="px-4 py-6 sm:px-8">
                <div className="space-y-6">
                  {/* Notes Section */}
                  {props.executionNextDelivery?.notes && (
                    <div className="tone-warning rounded-2xl p-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>הערות ודגשים</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold leading-relaxed">
                        {props.executionNextDelivery.notes}
                      </div>
                    </div>
                  )}

                  {/* Items Section */}
                  {nextStopItemsLabel && (
                    <div className="surface-info-panel rounded-2xl p-4">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-info-label">
                        <PackageCheck className="h-3.5 w-3.5" />
                        <span>פירוט פריטים להפצה</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold leading-relaxed text-fg-muted">
                        {nextStopItemsLabel}
                      </div>
                    </div>
                  )}

                  {/* Secondary Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={props.onOpenOrder}
                      className="flex-1 h-14 rounded-2xl border-subtle bg-surface font-black text-fg shadow-sm"
                    >
                      <Play className="h-4 w-4" />
                      צפייה בהזמנה המלאה
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-14 px-6 rounded-2xl border-subtle bg-surface font-black text-fg-muted"
                        >
                          <Clock3 className="h-4 w-4" />
                          דחייה
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[240px]">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                          סיבת דחייה
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => props.onDeferNextStop('WAITING_CUSTOMER')}
                          className="font-bold py-3"
                        >
                          לקוח לא זמין
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => props.onDeferNextStop('MISSING_DETAILS')}
                          className="font-bold py-3"
                        >
                          בעיה טכנית/חוסר מידע
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-2 text-center text-[10px] font-semibold text-on-inverse-muted sm:mt-3 sm:text-[11px]">
            {props.activeRouteCompletedCount}/{props.activeRouteGroup.items.length} הושלמו
            {trackingLabel ? ` • ${trackingLabel}` : ''}
          </div>
        </div>
      )}
    </main>
  );
}
