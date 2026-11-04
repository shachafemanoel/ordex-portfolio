'use client';

import { useAuth } from '@/components/AuthProvider';
import { FieldExecutionScreen } from '@/components/ops/deliveries/FieldExecutionScreen';
import { PickupBoard } from '@/components/ops/deliveries/PickupBoard';
import { deliverySessionToRouteGroup } from '@/components/ops/deliveries/types';
import { useDeliveryExecutionSession } from '@/components/ops/deliveries/useDeliveryExecutionSession';
import DeliveryOpsFloatingModal from '@/components/ops/shared/DeliveryOpsFloatingModal';
import { OpsCompactHeader } from '@/components/ops/shared/OpsBoardPrimitives';
import { toDateInputValue } from '@/components/orders/ops/workflow/utils';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OrderFilterParams } from '@/lib/api/types';
import { ACCENT_HEX_500, PRIMARY_HEX_500 } from '@/lib/designTokens';
import { ordersApi } from '@/lib/api/services';
import type { StartDeliveryRouteSessionInput } from '@/lib/delivery-route-session';
import { isOrdersApiError, toOrdersApiError, useOrdersQuery } from '@/lib/hooks/api/orders';
import { orderQueryKeys } from '@/lib/hooks/api/orders/queryKeys';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@prisma/client';
import { addDays, endOfWeek, startOfDay } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  LocateFixed,
  PackageCheck,
  RefreshCw,
  Router,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type DeliverySortMode = 'smart' | 'eta' | 'schedule' | 'city';
type DeliverySplitStrategy = 'none' | 'zones';
export type DeliveriesScreenMode = 'overview' | 'active-route';
const DELIVERY_STOP_SERVICE_MINUTES = 60;
const DEFAULT_ROUTE_DATE = toDateInputValue(new Date());

const DELIVERY_TABS = [
  {
    id: 'pickup',
    labelKey: 'deliveries.tab.pickup',
    fallback: 'לאיסוף',
    icon: PackageCheck,
    activeClassName: 'border-primary-200 bg-primary-50 text-brand',
    countClassName: 'text-primary-500',
  },
  {
    id: 'transit',
    labelKey: 'deliveries.tab.transit',
    fallback: 'בדרך',
    icon: Truck,
    activeClassName: 'border-primary-200 bg-primary-50 text-brand',
    countClassName: 'text-primary-500',
  },
] as const;

type DeliveryTabMeta = (typeof DELIVERY_TABS)[number];
type DeliveryTabId = DeliveryTabMeta['id'];
type DeliveryFilterId = DeliveryTabId | null;

const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = [
  'READY_FOR_INSTALL',
  'READY',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
];

const ACTIVE_DELIVERY_STATUS_SET = new Set<string>(ACTIVE_DELIVERY_STATUSES);
const TRANSIT_STATUSES = new Set<string>(['IN_TRANSIT', 'INSTALLATION']);

interface RawOrderItem {
  name?: string;
  productName?: string;
  quantity?: number | string;
  qty?: number | string;
}

interface DeliveryOrderData {
  id: string;
  number: string;
  status: string;
  customer?: { name?: string; phone?: string | null };
  customerName?: string | null;
  customerPhone?: string | null;
  city?: string | null;
  addressLine?: string | null;
  address?: string | null;
  shippingAddress?: {
    addressLine?: string | null;
    street?: string | null;
    number?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    coordinates?: { lat?: number | null; lng?: number | null } | null;
  } | null;
  scheduledAt?: string | null;
  notes?: string | null;
  note?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  totalCents?: number;
  itemsCount?: number;
  items?: RawOrderItem[];
  lineItems?: RawOrderItem[];
  _count?: { items?: number };
  assignedUserId?: string | null;
  assignedUser?: { id?: string; name?: string | null } | null;
}

interface DeliveryBoardItem {
  id: string;
  number: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  city: string | null;
  addressLine: string;
  scheduledAt: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  itemsSummary: string | null;
  itemLabels: string[];
  itemsCount: number;
  etaMinutes: number | null;
  distanceKm: number | null;
  routeIndex: number | null;
  estimatedArrivalAt: string | null;
  estimatedCompletionAt: string | null;
  geocodeSource: 'existing' | 'mapbox' | 'missing';
  routeBucket: 'today' | 'tomorrow';
  autoDeferredToDate: string | null;
  groupId: string | null;
  groupLabel: string | null;
  groupColor: string | null;
  workerIndex: number | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
}

interface DeliveryPlanningResponse {
  data?: {
    items?: Array<{
      id: string;
      lat: number | null;
      lng: number | null;
      etaMinutes: number | null;
      distanceKm: number | null;
      routeIndex: number | null;
      estimatedArrivalAt?: string | null;
      estimatedCompletionAt?: string | null;
      geocodeSource: 'existing' | 'mapbox' | 'missing';
      routeBucket?: 'today' | 'tomorrow';
      autoDeferredToDate?: string | null;
      groupId?: string | null;
      groupLabel?: string | null;
      groupColor?: string | null;
      workerIndex?: number | null;
    }>;
    summary?: {
      geocodedCount?: number;
      etaCount?: number;
      routeStopCount?: number;
      routeDurationMinutes?: number | null;
      routeDriveMinutes?: number | null;
      routeServiceMinutes?: number | null;
      routeDistanceKm?: number | null;
      hasOrigin?: boolean;
      originSource?: 'user' | 'store' | 'none';
      originLabel?: string | null;
      departureAt?: string | null;
      effectiveWorkloadMinutes?: number;
      businessDayStartTime?: string;
      businessDayEndTime?: string;
      businessHoursLabel?: string;
      businessDayAvailableMinutes?: number;
      exceedsBusinessHours?: boolean;
      overflowMinutes?: number;
      operationalRouteLimitMinutes?: number;
      exceedsOperationalLimit?: boolean;
      operationalOverflowMinutes?: number;
      preSplitWorkloadMinutes?: number;
      preSplitOperationalOverflowMinutes?: number;
      autoSplitApplied?: boolean;
      deferredStopCount?: number;
      deferredDateKey?: string | null;
      deferredWorkloadMinutes?: number | null;
      groupingStrategy?: DeliverySplitStrategy;
      requestedWorkerCount?: number;
      activeWorkerCount?: number;
      zoneSplitApplied?: boolean;
    };
    route?: {
      coordinates?: Array<[number, number]>;
      orderedIds?: string[];
      durationMinutes?: number | null;
      driveDurationMinutes?: number | null;
      serviceDurationMinutes?: number | null;
      distanceKm?: number | null;
      departureAt?: string | null;
    } | null;
    deferred?: {
      dateKey?: string;
      route?: {
        coordinates?: Array<[number, number]>;
        orderedIds?: string[];
        durationMinutes?: number | null;
        driveDurationMinutes?: number | null;
        serviceDurationMinutes?: number | null;
        distanceKm?: number | null;
        departureAt?: string | null;
      } | null;
    } | null;
    routeGroups?: Array<{
      id: string;
      label: string;
      color: string;
      workerIndex: number;
      items: Array<{ id: string }>;
      route?: {
        coordinates?: Array<[number, number]>;
      } | null;
      summary?: {
        routeStopCount?: number;
        routeDurationMinutes?: number | null;
        routeDistanceKm?: number | null;
        effectiveWorkloadMinutes?: number;
      };
    }>;
    origin?: {
      lat: number;
      lng: number;
    } | null;
  };
}

interface RouteGroupSummary {
  routeStopCount?: number;
  routeDurationMinutes?: number | null;
  routeDistanceKm?: number | null;
  effectiveWorkloadMinutes?: number;
}

interface DeliveryRouteGroupView {
  id: string;
  label: string;
  color: string;
  workerIndex: number;
  items: DeliveryBoardItem[];
  routeCoordinates: Array<[number, number]>;
  summary?: RouteGroupSummary;
  cityLabels: string[];
  assignedWorkerName: string | null;
  leadDelivery: DeliveryBoardItem | null;
}

type ChecklistStateByRouteId = Record<string, string[]>;

type MapboxConfigResponse = {
  data?: {
    token?: string;
    styleId?: string;
  };
};

const SORT_OPTIONS: Array<{
  id: DeliverySortMode;
  label: string;
  icon: typeof Router;
}> = [
  { id: 'smart', label: 'סדר מסלול', icon: Router },
  { id: 'schedule', label: 'לפי שעה', icon: Clock3 },
];

function normalizeTab(raw: string | null): DeliveryFilterId {
  if (raw === 'pickup' || raw === 'transit') {
    return raw;
  }
  return null;
}

function normalizeRouteDate(raw: string | null): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : DEFAULT_ROUTE_DATE;
}

function shiftRouteDateValue(value: string, offsetDays: number): string {
  const normalized = normalizeRouteDate(value);
  const date = new Date(`${normalized}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return DEFAULT_ROUTE_DATE;
  }

  date.setDate(date.getDate() + offsetDays);
  return toDateInputValue(date);
}

function getFetchErrorMessage(error: unknown, fallback: string): string {
  if (isOrdersApiError(error)) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function formatClockTime(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value < 60) {
    return `${value} דק'`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} ש' ${minutes} דק'` : `${hours} ש'`;
}

function formatDistanceLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  const normalized = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${normalized} ק"מ`;
}

function toggleChecklistSelection(
  state: ChecklistStateByRouteId,
  routeId: string,
  itemId: string
): ChecklistStateByRouteId {
  const next = new Set(state[routeId] ?? []);
  if (next.has(itemId)) {
    next.delete(itemId);
  } else {
    next.add(itemId);
  }

  return {
    ...state,
    [routeId]: Array.from(next),
  };
}

function buildItemsMeta(items: RawOrderItem[]): {
  summary: string | null;
  count: number;
  labels: string[];
} {
  if (!items.length) {
    return { summary: null, count: 0, labels: [] };
  }

  const labels = items
    .map((item) => {
      const baseLabel = item.name || item.productName;
      if (typeof baseLabel !== 'string' || !baseLabel.trim()) {
        return null;
      }

      const rawQuantity = item.quantity ?? item.qty;
      const quantity =
        typeof rawQuantity === 'string' ? Number.parseFloat(rawQuantity) : rawQuantity;
      const quantityLabel =
        typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
          ? ` ×${quantity}`
          : '';

      return `${baseLabel.trim()}${quantityLabel}`;
    })
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const count = items.length;
  if (!labels.length) {
    return { summary: null, count, labels: [] };
  }

  const visible = labels.slice(0, 2);
  const remaining = Math.max(labels.length - visible.length, 0);
  return {
    summary: `${visible.join(' • ')}${remaining > 0 ? ` +${remaining}` : ''}`,
    count,
    labels,
  };
}

function getSearchValue(item: DeliveryBoardItem): string {
  return [
    item.number,
    item.customerName,
    item.customerPhone ?? '',
    item.city ?? '',
    item.addressLine,
    item.notes ?? '',
    item.itemsSummary ?? '',
    item.itemLabels.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function resolveDeliveryTab(
  item: Pick<DeliveryBoardItem, 'status' | 'scheduledAt'>
): DeliveryTabId {
  if (TRANSIT_STATUSES.has(item.status)) {
    return 'transit';
  }

  return 'pickup';
}

function mapOrderToDeliveryItem(order: DeliveryOrderData): DeliveryBoardItem {
  const rawItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.lineItems)
      ? order.lineItems
      : [];

  const itemsMeta = buildItemsMeta(rawItems);
  const lat =
    order.lat ??
    order.latitude ??
    order.shippingAddress?.lat ??
    order.shippingAddress?.coordinates?.lat ??
    null;
  const lng =
    order.lng ??
    order.longitude ??
    order.shippingAddress?.lng ??
    order.shippingAddress?.coordinates?.lng ??
    null;

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    customerName:
      order.customer?.name?.trim() || order.customerName?.trim() || DISPLAY_TEXT.unknownCustomer,
    customerPhone: order.customerPhone ?? order.customer?.phone ?? null,
    city: order.city ?? order.shippingAddress?.city ?? null,
    addressLine:
      order.addressLine ||
      order.address ||
      order.shippingAddress?.addressLine ||
      [order.shippingAddress?.street, order.shippingAddress?.number].filter(Boolean).join(' ') ||
      DISPLAY_TEXT.noAddress,
    scheduledAt: order.scheduledAt ?? null,
    notes: order.notes ?? order.note ?? null,
    lat,
    lng,
    itemsSummary: itemsMeta.summary,
    itemLabels: itemsMeta.labels,
    itemsCount:
      (typeof order._count?.items === 'number' && order._count.items > 0
        ? order._count.items
        : null) ??
      (typeof order.itemsCount === 'number' && order.itemsCount > 0 ? order.itemsCount : null) ??
      itemsMeta.count,
    etaMinutes: null,
    distanceKm: null,
    routeIndex: null,
    estimatedArrivalAt: null,
    estimatedCompletionAt: null,
    geocodeSource: typeof lat === 'number' && typeof lng === 'number' ? 'existing' : 'missing',
    routeBucket: 'today',
    autoDeferredToDate: null,
    groupId: null,
    groupLabel: null,
    groupColor: null,
    workerIndex: null,
    assignedUserId: order.assignedUserId ?? null,
    assignedUserName: order.assignedUser?.name?.trim() ?? null,
  };
}

export type DeliveriesNavigationHost = 'ops' | 'dashboard';

export function DeliveriesWorkspace({
  screenMode = 'overview',
  navigationHost = 'ops',
  /** ממשק תכנון לפי אזורים (כמו בדשבורד) תוך שמירה על ניווט ops ב־/deliveries */
  simplifiedBoard = false,
}: Readonly<{
  screenMode?: DeliveriesScreenMode;
  navigationHost?: DeliveriesNavigationHost;
  simplifiedBoard?: boolean;
}>) {
  const { t, direction } = useUITranslation();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<DeliveryFilterId>(() =>
    normalizeTab(searchParams.get('tab'))
  );
  const [selectedRouteDate, setSelectedRouteDate] = useState<string>(() =>
    normalizeRouteDate(searchParams.get('date'))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);
  const [showBoardInfo, setShowBoardInfo] = useState(false);
  const [sortMode, setSortMode] = useState<DeliverySortMode>('smart');
  const [splitStrategy, setSplitStrategy] = useState<DeliverySplitStrategy>('zones');
  const [workerCount, setWorkerCount] = useState('3');
  const [selectedRouteGroupId, setSelectedRouteGroupId] = useState<string | null>(null);
  const [activeExecutionRouteId, setActiveExecutionRouteId] = useState<string | null>(null);
  const [selectedWorkerByGroupId, setSelectedWorkerByGroupId] = useState<Record<string, string>>(
    {}
  );
  const [pickupChecklistByRouteId, setPickupChecklistByRouteId] = useState<ChecklistStateByRouteId>(
    {}
  );
  const [arrivedStopIdsByRouteId, setArrivedStopIdsByRouteId] = useState<ChecklistStateByRouteId>(
    {}
  );
  const [completedStopIdsByRouteId, setCompletedStopIdsByRouteId] =
    useState<ChecklistStateByRouteId>({});
  const [deferredStopIdsByRouteId, setDeferredStopIdsByRouteId] = useState<ChecklistStateByRouteId>(
    {}
  );
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'locating' | 'ready' | 'denied' | 'unsupported'
  >('idle');
  const [mounted, setMounted] = useState(false);
  const [freeSelectionMode, setFreeSelectionMode] = useState(false);
  const [freeSelectedIds, setFreeSelectedIds] = useState<string[]>([]);
  const [isFreeRoutePending, setIsFreeRoutePending] = useState(false);
  const [dashboardRoutePreview, setDashboardRoutePreview] = useState<{
    orderedItems: DeliveryBoardItem[];
    planResult: DeliveryPlanningResponse;
  } | null>(null);
  const [dashboardPreviewSeconds, setDashboardPreviewSeconds] = useState(0);
  const autoRouteModeInitializedRef = useRef(false);
  const { user: currentUser } = useAuth();
  const {
    session: activeSession,
    liveLocation,
    trackingStatus,
    startSession,
    updateSession,
    isLoading: isSessionLoading,
    isStartingSession,
    isUpdatingSession,
  } = useDeliveryExecutionSession(Boolean(currentUser?.id));
  const activeSessionId = activeSession?.id ?? null;
  const activeSessionRouteGroupId = activeSession?.routeGroup.id ?? null;
  const activeSessionCurrentStopId = activeSession?.currentStop?.id ?? null;
  const hasActiveSession = Boolean(activeSession);
  const currentUserRole = String(currentUser?.role ?? '').toUpperCase();
  const hasGlobalDeliveryVisibility =
    currentUserRole === 'ADMIN' || currentUserRole === 'OPERATIONS';
  const showOverviewOverride = searchParams.get('showOverview') === '1';
  const useSimplifiedPlannerUi = simplifiedBoard || navigationHost === 'dashboard';

  const dashboardHubTab =
    navigationHost === 'dashboard'
      ? ((searchParams.get('hub') ?? 'active') as 'trip' | 'active' | 'future')
      : 'active';

  const ordersListFilters: OrderFilterParams = useMemo(() => {
    const base = {
      status: ACTIVE_DELIVERY_STATUSES,
      limit: 200,
      includeItems: true,
      sort: 'scheduledAt' as const,
      dir: 'asc' as const,
    };

    if (navigationHost !== 'dashboard') {
      if (simplifiedBoard) {
        const today = toDateInputValue(new Date());
        if (selectedRouteDate === today) {
          return { ...base, scheduledAt: today, includeUnscheduledReady: true };
        }
      }
      return { ...base, scheduledAt: selectedRouteDate };
    }

    if (dashboardHubTab === 'future') {
      const now = new Date();
      const from = addDays(startOfDay(now), 1);
      const to = endOfWeek(now, { weekStartsOn: 0 });
      return {
        ...base,
        scheduledAtFrom: toDateInputValue(from),
        scheduledAtTo: toDateInputValue(to),
      };
    }

    const today = toDateInputValue(new Date());
    if (selectedRouteDate === today) {
      return { ...base, scheduledAt: today, includeUnscheduledReady: true };
    }

    return { ...base, scheduledAt: selectedRouteDate };
  }, [dashboardHubTab, navigationHost, selectedRouteDate, simplifiedBoard]);

  const resolveDashboardWorkspaceUrl = useCallback(
    (mode: DeliveriesScreenMode, params: URLSearchParams) => {
      params.delete('showOverview');
      const hub =
        mode === 'active-route'
          ? 'trip'
          : params.get('hub') === 'future' || searchParams.get('hub') === 'future'
            ? 'future'
            : 'active';
      params.set('hub', hub);
      const query = params.toString();
      return query ? `/dashboard/operations?${query}` : '/dashboard/operations';
    },
    [searchParams]
  );

  const buildDeliveriesHref = useCallback(
    (mode: DeliveriesScreenMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('date', selectedRouteDate);

      if (navigationHost === 'dashboard') {
        return resolveDashboardWorkspaceUrl(mode, params);
      }

      if (mode === 'overview') {
        params.set('showOverview', '1');
      } else {
        params.delete('showOverview');
      }

      const query = params.toString();
      return mode === 'active-route'
        ? query
          ? `/deliveries/active?${query}`
          : '/deliveries/active'
        : query
          ? `/deliveries?${query}`
          : '/deliveries';
    },
    [navigationHost, resolveDashboardWorkspaceUrl, searchParams, selectedRouteDate]
  );

  const currentTab = useMemo(
    () => (activeTab ? (DELIVERY_TABS.find((tab) => tab.id === activeTab) ?? null) : null),
    [activeTab]
  );

  const resolveLabel = (labelKey: string, fallback: string) => {
    const translated = t(labelKey);
    return translated === labelKey ? fallback : translated;
  };

  const lastDashboardHubRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const nextTab = normalizeTab(searchParams.get('tab'));
    const nextDate = normalizeRouteDate(searchParams.get('date'));
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    if (nextDate !== selectedRouteDate) {
      setSelectedRouteDate(nextDate);
    }
  }, [activeTab, searchParams, selectedRouteDate]);

  useEffect(() => {
    if (navigationHost !== 'dashboard') {
      return;
    }

    const hub = searchParams.get('hub') ?? 'active';
    const today = toDateInputValue(new Date());
    const prevHub = lastDashboardHubRef.current;

    if (hub === 'active' && prevHub !== null && prevHub !== 'active') {
      setSelectedRouteDate(today);
    }

    lastDashboardHubRef.current = hub;
  }, [navigationHost, searchParams]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (screenMode === 'overview') {
      if (hasActiveSession && !hasGlobalDeliveryVisibility && !showOverviewOverride) {
        startTransition(() => {
          router.replace(buildDeliveriesHref('active-route'), { scroll: false });
        });
      }
      return;
    }

    if (!hasActiveSession) {
      startTransition(() => {
        router.replace(buildDeliveriesHref('overview'), { scroll: false });
      });
    }
  }, [
    buildDeliveriesHref,
    hasActiveSession,
    hasGlobalDeliveryVisibility,
    isSessionLoading,
    router,
    screenMode,
    showOverviewOverride,
  ]);

  const { data, isLoading, isFetching, error, refetch } = useOrdersQuery({
    filters: ordersListFilters,
    options: {
      refetchInterval: 30_000,
    },
  });

  const { data: mapboxConfigData } = useQuery({
    queryKey: ['mapbox-config'],
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/mapbox/config', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Mapbox is not configured');
      }

      return (await response.json()) as MapboxConfigResponse;
    },
  });

  const allDeliveries = useMemo(() => {
    const items = data?.items ? (data.items as DeliveryOrderData[]) : [];
    return items
      .filter((item) => ACTIVE_DELIVERY_STATUS_SET.has(String(item.status)))
      .map((item) => mapOrderToDeliveryItem(item));
  }, [data?.items]);

  const visibleCourierDeliveries = useMemo(() => {
    if (!currentUser?.id) {
      return allDeliveries;
    }

    if (hasGlobalDeliveryVisibility) {
      return allDeliveries;
    }

    const hasAssignedDeliveries = allDeliveries.some(
      (item) => item.assignedUserId === currentUser.id
    );

    if (hasAssignedDeliveries) {
      // If the courier already has assigned deliveries, focus only on their active route.
      return allDeliveries.filter((item) => item.assignedUserId === currentUser.id);
    }

    // Otherwise show only available deliveries to collect (unassigned).
    return allDeliveries.filter((item) => !item.assignedUserId);
  }, [allDeliveries, currentUser?.id, hasGlobalDeliveryVisibility]);

  const searchedDeliveries = useMemo(() => {
    if (!deferredSearchQuery) {
      return visibleCourierDeliveries;
    }

    const normalizedQuery = deferredSearchQuery.toLowerCase();
    return visibleCourierDeliveries.filter((item) =>
      getSearchValue(item).includes(normalizedQuery)
    );
  }, [visibleCourierDeliveries, deferredSearchQuery]);

  const tabDeliveries = useMemo(
    () =>
      activeTab === null
        ? searchedDeliveries
        : searchedDeliveries.filter((item) => resolveDeliveryTab(item) === activeTab),
    [activeTab, searchedDeliveries]
  );

  const tabCounts = useMemo(() => {
    const counts = new Map<DeliveryTabId, number>();
    for (const tab of DELIVERY_TABS) {
      counts.set(
        tab.id,
        allDeliveries.filter((item) => resolveDeliveryTab(item) === tab.id).length
      );
    }
    return counts;
  }, [allDeliveries]);

  const visibleDeliveries = tabDeliveries;

  const planningInputSignature = useMemo(
    () =>
      allDeliveries
        .map(
          (item) =>
            `${item.id}:${item.lat ?? 'x'}:${item.lng ?? 'x'}:${item.addressLine}:${item.city ?? ''}:${item.scheduledAt ?? ''}`
        )
        .join('|'),
    [allDeliveries]
  );

  const requestOriginLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      return;
    }

    setLocationStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('ready');
      },
      () => {
        setLocationStatus('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60_000,
      }
    );
  }, []);

  const planningDisabled = useSimplifiedPlannerUi && screenMode === 'overview';
  const effectiveSplitStrategy: DeliverySplitStrategy = useSimplifiedPlannerUi
    ? 'none'
    : splitStrategy;
  const effectiveWorkerCount = useSimplifiedPlannerUi ? '1' : workerCount;

  const { data: planningData, isFetching: planningFetching } = useQuery({
    queryKey: [
      'deliveries-mapbox-plan',
      sortMode,
      effectiveSplitStrategy,
      effectiveWorkerCount,
      planningDisabled,
      planningInputSignature,
      origin?.lat ?? null,
      origin?.lng ?? null,
    ],
    enabled: !planningDisabled && allDeliveries.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch('/api/mapbox/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sortMode,
          origin,
          grouping: {
            strategy: effectiveSplitStrategy,
            workerCount: Number.parseInt(effectiveWorkerCount, 10) || 1,
          },
          items: allDeliveries.map((item) => ({
            id: item.id,
            number: item.number,
            customerName: item.customerName,
            status: item.status,
            addressLine: item.addressLine,
            city: item.city,
            scheduledAt: item.scheduledAt,
            serviceMinutes: DELIVERY_STOP_SERVICE_MINUTES,
            lat: item.lat,
            lng: item.lng,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch delivery planning data');
      }

      return (await response.json()) as DeliveryPlanningResponse;
    },
  });

  const plannedActiveDeliveries = useMemo(() => {
    const planningItems = planningData?.data?.items ?? [];
    if (!planningItems.length) {
      return [...allDeliveries].sort((left, right) => {
        const leftTime = left.scheduledAt
          ? new Date(left.scheduledAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightTime = right.scheduledAt
          ? new Date(right.scheduledAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (leftTime !== rightTime) return leftTime - rightTime;

        const leftTab = resolveDeliveryTab(left);
        const rightTab = resolveDeliveryTab(right);
        const phasePriority = (tab: string) => (tab === 'pickup' ? 1 : 2);
        const phaseDiff = phasePriority(leftTab) - phasePriority(rightTab);
        if (phaseDiff !== 0) return phaseDiff;

        if (leftTab === 'pickup') {
          const leftNoSchedule = !left.scheduledAt;
          const rightNoSchedule = !right.scheduledAt;
          if (leftNoSchedule && !rightNoSchedule) return -1;
          if (!leftNoSchedule && rightNoSchedule) return 1;
        }

        if (leftTab === 'transit') {
          const statusPriority = (s: string) => (s === 'IN_TRANSIT' ? 0 : 1);
          const diff = statusPriority(left.status) - statusPriority(right.status);
          if (diff !== 0) return diff;
        }

        return 0;
      });
    }

    const baseItems = new Map(allDeliveries.map((item) => [item.id, item]));
    const merged = planningItems
      .map((item) => {
        const base = baseItems.get(item.id);
        if (!base) return null;
        return {
          ...base,
          lat: item.lat ?? base.lat,
          lng: item.lng ?? base.lng,
          etaMinutes: item.etaMinutes ?? null,
          distanceKm: item.distanceKm ?? null,
          routeIndex: item.routeIndex ?? null,
          estimatedArrivalAt: item.estimatedArrivalAt ?? null,
          estimatedCompletionAt: item.estimatedCompletionAt ?? null,
          geocodeSource: item.geocodeSource ?? base.geocodeSource,
          routeBucket: item.routeBucket ?? base.routeBucket,
          autoDeferredToDate: item.autoDeferredToDate ?? base.autoDeferredToDate,
          groupId: item.groupId ?? base.groupId,
          groupLabel: item.groupLabel ?? base.groupLabel,
          groupColor: item.groupColor ?? base.groupColor,
          workerIndex: item.workerIndex ?? base.workerIndex,
        };
      })
      .filter((item): item is DeliveryBoardItem => item !== null);

    const mergedIds = new Set(merged.map((item) => item.id));
    const leftovers = allDeliveries
      .filter((item) => !mergedIds.has(item.id))
      .sort((a, b) => {
        if (resolveDeliveryTab(a) === 'pickup' || resolveDeliveryTab(b) === 'pickup') {
          const aNo = !a.scheduledAt;
          const bNo = !b.scheduledAt;
          if (aNo && !bNo) return -1;
          if (!aNo && bNo) return 1;
        }
        return 0;
      });
    return [...merged, ...leftovers];
  }, [allDeliveries, planningData?.data?.items]);

  const plannedDeliveries = useMemo(() => {
    if (!visibleDeliveries.length) {
      return [];
    }

    const visibleIds = new Set(visibleDeliveries.map((item) => item.id));
    return plannedActiveDeliveries.filter((item) => visibleIds.has(item.id));
  }, [plannedActiveDeliveries, visibleDeliveries]);

  const prefetchOrderDetail = useCallback(
    async (orderId: string) => {
      if (!orderId) return;

      await queryClient.prefetchQuery({
        queryKey: orderQueryKeys.detail(orderId),
        queryFn: async () => {
          const response = await ordersApi.get(orderId);
          if (!response.success) {
            throw toOrdersApiError(response.error, 'Failed to prefetch order');
          }
          return response.data;
        },
        staleTime: 15_000,
      });
    },
    [queryClient]
  );

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const result = await ordersApi.changeStatus(orderId, status);
      if (!result.success) {
        throw toOrdersApiError(result.error, 'Failed to update order status');
      }
      return { orderId, order: result.data };
    },
    onSuccess: async ({ orderId, order }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['orders', 'status-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) }),
      ]);

      if (order) {
        queryClient.setQueryData(orderQueryKeys.detail(orderId), order);
      }
    },
    onError: (error) => {
      toast.error('עדכון משלוח נכשל', error instanceof Error ? error.message : undefined);
    },
  });

  const changeStatus = async (orderId: string, status: OrderStatus) => {
    await statusMutation.mutateAsync({ orderId, status });
  };

  const deliveryTaskMutation = useMutation({
    mutationFn: async ({
      orderId,
      actionType,
      payload,
    }: {
      orderId: string;
      actionType: 'MARK_PICKED' | 'MARK_DELIVERED' | 'DEFER' | 'SET_CUSTOMER_WAIT';
      payload?: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/orders/${orderId}/delivery-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          payload: payload ?? {},
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error?.message || result?.message || 'שגיאה בביצוע פעולת משלוח');
      }

      return { orderId, result: await response.json().catch(() => null) };
    },
    onSuccess: async ({ orderId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) }),
        queryClient.invalidateQueries({ queryKey: ['deliveries-mapbox-plan'] }),
      ]);
    },
    onError: (error) => {
      toast.error('פעולת משלוח נכשלה', error instanceof Error ? error.message : undefined);
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: async ({ groupId, workerId }: { groupId: string; workerId: string }) => {
      const group = routeGroups.find((entry) => entry.id === groupId);
      if (!group) {
        throw new Error('קבוצת המסלול לא נמצאה');
      }

      const responses = await Promise.all(
        group.items.map(async (item) => {
          const response = await fetch(`/api/orders/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedUserId: workerId || null }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(
              payload?.error?.message || payload?.message || 'שגיאה בהקצאת מסלול לעובד'
            );
          }

          return response.json().catch(() => null);
        })
      );

      return {
        groupId,
        workerId,
        updatedCount: responses.length,
      };
    },
    onSuccess: async ({ groupId, workerId, updatedCount }) => {
      setSelectedWorkerByGroupId((prev) => ({
        ...prev,
        [groupId]: workerId,
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['deliveries-mapbox-plan'] }),
      ]);
      toast.success('המסלול הוקצה לעובד', `${updatedCount} הזמנות עודכנו במסלול הזה.`);
    },
    onError: (error) => {
      toast.error('הקצאת מסלול נכשלה', error instanceof Error ? error.message : undefined);
    },
  });

  const updateUrl = (tab: DeliveryFilterId, orderId?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', selectedRouteDate);
    if (tab) params.set('tab', tab);
    else params.delete('tab');
    if (orderId) params.set('orderId', orderId);
    else params.delete('orderId');

    let path: string;
    if (navigationHost === 'dashboard') {
      path = resolveDashboardWorkspaceUrl(screenMode, params);
    } else {
      if (screenMode === 'active-route') {
        params.delete('showOverview');
      } else if (showOverviewOverride || (hasActiveSession && !hasGlobalDeliveryVisibility)) {
        params.set('showOverview', '1');
      } else {
        params.delete('showOverview');
      }
      const query = params.toString();
      path =
        screenMode === 'active-route'
          ? query
            ? `/deliveries/active?${query}`
            : '/deliveries/active'
          : query
            ? `/deliveries?${query}`
            : '/deliveries';
    }

    startTransition(() => {
      router.replace(path, { scroll: false });
    });
  };

  const handleSelectDelivery = (delivery: DeliveryBoardItem, options?: { openModal?: boolean }) => {
    const nextTab =
      activeSession || activeExecutionRouteId
        ? 'transit'
        : activeTab === null
          ? null
          : resolveDeliveryTab(delivery);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    setSelectedDeliveryId(delivery.id);
    updateUrl(nextTab, delivery.id);
    prefetchOrderDetail(delivery.id).catch(() => undefined);
    if (options?.openModal ?? true) {
      setModalOrderId(delivery.id);
    }
  };

  const handleSelectRouteGroup = (groupId: string) => {
    setSelectedRouteGroupId((current) => (current === groupId ? null : groupId));
  };

  const handleClearRouteGroupFocus = () => {
    setSelectedRouteGroupId(null);
  };

  const handleTogglePickupItem = (routeId: string, itemId: string) => {
    setPickupChecklistByRouteId((prev) => toggleChecklistSelection(prev, routeId, itemId));
  };

  const handleTakeRoute = async (groupId: string) => {
    const group = routePanels.find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    const checkedIds = new Set(pickupChecklistByRouteId[groupId] ?? []);
    const isReady = group.items.length > 0 && group.items.every((item) => checkedIds.has(item.id));

    if (!isReady) {
      toast.error('אי אפשר להתחיל מסלול', 'סמן קודם שכל ההזמנות נאספו מהמחסן.');
      return;
    }

    try {
      const targetWorkerId =
        currentUser?.id ?? selectedWorkerByGroupId[groupId] ?? group.items[0]?.assignedUserId ?? '';

      if (targetWorkerId) {
        await assignGroupMutation.mutateAsync({
          groupId,
          workerId: targetWorkerId,
        });
      }

      await Promise.all(
        group.items.map((item) =>
          deliveryTaskMutation.mutateAsync({
            orderId: item.id,
            actionType: 'MARK_PICKED',
          })
        )
      );

      const sessionPayload: StartDeliveryRouteSessionInput = {
        routeDateKey: selectedRouteDate,
        routeGroup: {
          id: group.id,
          label: group.label,
          color: group.color,
          workerIndex: group.workerIndex,
          items: group.items.map((item) => ({
            id: item.id,
            number: item.number,
            status: 'IN_TRANSIT',
            customerName: item.customerName,
            customerPhone: item.customerPhone,
            city: item.city,
            addressLine: item.addressLine,
            scheduledAt: item.scheduledAt,
            notes: item.notes,
            lat: item.lat,
            lng: item.lng,
            itemsSummary: item.itemsSummary,
            itemLabels: item.itemLabels,
            itemsCount: item.itemsCount ?? 0,
            etaMinutes: item.etaMinutes,
            distanceKm: item.distanceKm,
            routeIndex: item.routeIndex,
            estimatedArrivalAt: item.estimatedArrivalAt,
            estimatedCompletionAt: item.estimatedCompletionAt,
          })),
          routeCoordinates: group.routeCoordinates,
          summary: group.summary
            ? {
                routeStopCount: group.summary.routeStopCount,
                routeDurationMinutes: group.summary.routeDurationMinutes ?? null,
                routeDistanceKm: group.summary.routeDistanceKm ?? null,
                effectiveWorkloadMinutes: group.summary.effectiveWorkloadMinutes,
              }
            : null,
        },
      };

      const sessionResponse = await startSession(sessionPayload);

      setDeferredStopIdsByRouteId((prev) => ({
        ...prev,
        [groupId]: [],
      }));
      setActiveExecutionRouteId(groupId);
      setSelectedRouteGroupId(groupId);
      setActiveTab('transit');

      const nextDelivery = sessionResponse.data?.currentStop ?? group.items[0] ?? null;
      if (nextDelivery) {
        setSelectedDeliveryId(nextDelivery.id);
        prefetchOrderDetail(nextDelivery.id).catch(() => undefined);
      }

      startTransition(() => {
        router.push(buildDeliveriesHref('active-route'), { scroll: false });
      });

      toast.success(
        'המסלול התחיל',
        currentUser?.name
          ? `המשלוחים הוקצו ל-${currentUser.name} והמסך עבר למצב שטח.`
          : 'המשלוחים סומנו כנאספו והמסך עבר למצב שטח.'
      );
    } catch (error) {
      toast.error('הפעלת מסלול נכשלה', error instanceof Error ? error.message : undefined);
    }
  };

  const handleBackToDeliveries = () => {
    startTransition(() => {
      router.push(buildDeliveriesHref('overview'), { scroll: false });
    });
  };

  const handleMarkArrival = async (routeId: string, deliveryId: string) => {
    if (activeSession) {
      try {
        await updateSession({
          actionType: 'MARK_ARRIVED',
          orderId: deliveryId,
        });
      } catch (error) {
        toast.error('סימון הגעה נכשל', error instanceof Error ? error.message : undefined);
        return;
      }
    }

    setArrivedStopIdsByRouteId((prev) => {
      if ((prev[routeId] ?? []).includes(deliveryId)) {
        return prev;
      }

      return {
        ...prev,
        [routeId]: [...(prev[routeId] ?? []), deliveryId],
      };
    });
  };

  const handleDeferNextStop = async (
    routeId: string,
    deliveryId: string,
    reason: 'WAITING_CUSTOMER' | 'MISSING_DETAILS'
  ) => {
    try {
      await deliveryTaskMutation.mutateAsync({
        orderId: deliveryId,
        actionType: reason === 'WAITING_CUSTOMER' ? 'SET_CUSTOMER_WAIT' : 'DEFER',
        payload: reason === 'WAITING_CUSTOMER' ? {} : { reason },
      });

      if (activeSession) {
        await updateSession({
          actionType: 'DEFER_STOP',
          orderId: deliveryId,
        });
      }

      setDeferredStopIdsByRouteId((prev) => {
        const next = new Set(prev[routeId] ?? []);
        next.add(deliveryId);
        return {
          ...prev,
          [routeId]: Array.from(next),
        };
      });

      setArrivedStopIdsByRouteId((prev) => ({
        ...prev,
        [routeId]: (prev[routeId] ?? []).filter((itemId) => itemId !== deliveryId),
      }));

      toast.success(
        'המשלוח נדחה לסוף המסלול',
        reason === 'WAITING_CUSTOMER' ? 'הלקוח לא זמין כרגע.' : 'המשלוח הועבר לטיפול בהמשך.'
      );
    } catch (error) {
      if (error instanceof Error && error.message) {
        toast.error('דחיית עצירה נכשלה', error.message);
      }
    }
  };

  const handleReleaseExecution = async () => {
    try {
      if (activeSession) await updateSession({ actionType: 'RELEASE_SESSION' });
      setActiveExecutionRouteId(null);
      setSelectedRouteGroupId(null);
    } catch (error) {
      toast.error('שחרור המסלול נכשל', error instanceof Error ? error.message : 'נסה שוב');
    }
  };

  const handleCompleteNextStop = async () => {
    if (!activeRouteGroup || !executionNextDelivery) {
      return;
    }

    try {
      await deliveryTaskMutation.mutateAsync({
        orderId: executionNextDelivery.id,
        actionType: 'MARK_DELIVERED',
      });

      const sessionResponse = activeSession
        ? await updateSession({
            actionType: 'COMPLETE_STOP',
            orderId: executionNextDelivery.id,
          })
        : null;

      setCompletedStopIdsByRouteId((prev) => {
        if ((prev[activeRouteGroup.id] ?? []).includes(executionNextDelivery.id)) {
          return prev;
        }

        return {
          ...prev,
          [activeRouteGroup.id]: [...(prev[activeRouteGroup.id] ?? []), executionNextDelivery.id],
        };
      });

      setArrivedStopIdsByRouteId((prev) => ({
        ...prev,
        [activeRouteGroup.id]: (prev[activeRouteGroup.id] ?? []).filter(
          (itemId) => itemId !== executionNextDelivery.id
        ),
      }));
      setDeferredStopIdsByRouteId((prev) => ({
        ...prev,
        [activeRouteGroup.id]: (prev[activeRouteGroup.id] ?? []).filter(
          (itemId) => itemId !== executionNextDelivery.id
        ),
      }));

      const remainingStops =
        sessionResponse?.data?.status === 'ACTIVE'
          ? deliverySessionToRouteGroup(sessionResponse.data).items.filter((item) => sessionResponse.data?.queue.some((stop) => stop.id === item.id))
          : activeExecutionStops.filter((item) => item.id !== executionNextDelivery.id);
      const nextDelivery = remainingStops[0] ?? null;

      if (nextDelivery) {
        handleSelectDelivery(nextDelivery, { openModal: false });
        toast.success('המשלוח סומן כהושלם', `היעד הבא: ${nextDelivery.customerName}.`);
        return;
      }

      toast.success('המסלול הושלם', 'כל העצירות במסלול סומנו כהושלמו.');
      setActiveExecutionRouteId(null);
      setSelectedRouteGroupId(null);
    } catch (error) {
      toast.error('סיום משלוח נכשל', error instanceof Error ? error.message : undefined);
    }
  };

  const handleTabChange = (tab: DeliveryTabId) => {
    const nextTab = activeTab === tab ? null : tab;
    setActiveTab(nextTab);
    updateUrl(nextTab, null);
  };

  const handleRouteDateChange = (value: string) => {
    const nextDate = normalizeRouteDate(value);
    setSelectedRouteDate(nextDate);
    setSelectedDeliveryId(null);
    setSelectedRouteGroupId(null);
    setActiveExecutionRouteId(null);
    setPickupChecklistByRouteId({});
    setArrivedStopIdsByRouteId({});
    setCompletedStopIdsByRouteId({});
    setDeferredStopIdsByRouteId({});
    setModalOrderId(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set('date', nextDate);
    params.delete('orderId');

    let path: string;
    if (navigationHost === 'dashboard') {
      path = resolveDashboardWorkspaceUrl(screenMode, params);
    } else {
      if (screenMode === 'active-route') {
        params.delete('showOverview');
      } else if (showOverviewOverride || (hasActiveSession && !hasGlobalDeliveryVisibility)) {
        params.set('showOverview', '1');
      } else {
        params.delete('showOverview');
      }
      const query = params.toString();
      path =
        screenMode === 'active-route'
          ? query
            ? `/deliveries/active?${query}`
            : '/deliveries/active'
          : query
            ? `/deliveries?${query}`
            : '/deliveries';
    }

    startTransition(() => {
      router.replace(path, { scroll: false });
    });
  };

  const handleShiftRouteDate = (offsetDays: number) => {
    handleRouteDateChange(shiftRouteDateValue(selectedRouteDate, offsetDays));
  };

  const handleSplitStrategyChange = (value: string) => {
    const nextStrategy = value as DeliverySplitStrategy;
    setSplitStrategy(nextStrategy);
    setSelectedRouteGroupId(null);
    setActiveExecutionRouteId(null);

    if (nextStrategy === 'zones' && workerCount !== '2' && workerCount !== '3') {
      setWorkerCount('3');
    }
  };

  const handleClearFilters = () => {
    setActiveTab(null);
    updateUrl(null, null);
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['deliveries-mapbox-plan'] }),
    ]);
  };

  const handleToggleFreeSelectionMode = () => {
    setFreeSelectionMode((prev) => !prev);
    setFreeSelectedIds([]);
  };

  const handleToggleFreeDelivery = (id: string) => {
    setFreeSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const finalizePlannedRoute = useCallback(
    async (orderedItems: DeliveryBoardItem[], planResult: DeliveryPlanningResponse) => {
      const freeGroupId = `free-${Date.now()}`;
      const cityLabels = Array.from(
        new Set(orderedItems.map((d) => d.city?.trim()).filter((v): v is string => Boolean(v)))
      ).slice(0, 3);
      const planSummary = planResult.data?.summary;

      if (currentUser?.id) {
        await Promise.all(
          orderedItems.map((item) =>
            fetch(`/api/orders/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assignedUserId: currentUser.id }),
            })
          )
        );
      }

      await Promise.all(
        orderedItems.map((item) =>
          deliveryTaskMutation.mutateAsync({ orderId: item.id, actionType: 'MARK_PICKED' })
        )
      );

      const sessionPayload: StartDeliveryRouteSessionInput = {
        routeDateKey: selectedRouteDate,
        routeGroup: {
          id: freeGroupId,
          label: cityLabels.length > 0 ? `מסלול ${cityLabels.join(', ')}` : 'מסלול מותאם',
          color: PRIMARY_HEX_500,
          workerIndex: 1,
          items: orderedItems.map((item) => ({
            id: item.id,
            number: item.number,
            status: 'IN_TRANSIT' as const,
            customerName: item.customerName,
            customerPhone: item.customerPhone,
            city: item.city,
            addressLine: item.addressLine,
            scheduledAt: item.scheduledAt,
            notes: item.notes,
            lat: item.lat,
            lng: item.lng,
            itemsSummary: item.itemsSummary,
            itemLabels: item.itemLabels,
            itemsCount: item.itemsCount ?? 0,
            etaMinutes: item.etaMinutes,
            distanceKm: item.distanceKm,
            routeIndex: item.routeIndex,
            estimatedArrivalAt: item.estimatedArrivalAt,
            estimatedCompletionAt: item.estimatedCompletionAt,
          })),
          routeCoordinates: planResult.data?.route?.coordinates ?? [],
          summary: planSummary
            ? {
                routeStopCount: orderedItems.length,
                routeDurationMinutes: planSummary.routeDurationMinutes ?? null,
                routeDistanceKm: planSummary.routeDistanceKm ?? null,
                effectiveWorkloadMinutes: planSummary.effectiveWorkloadMinutes,
              }
            : null,
        },
      };

      const sessionResponse = await startSession(sessionPayload);

      setDeferredStopIdsByRouteId((prev) => ({ ...prev, [freeGroupId]: [] }));
      setActiveExecutionRouteId(freeGroupId);
      setSelectedRouteGroupId(freeGroupId);
      setActiveTab('transit');
      setFreeSelectionMode(false);
      setFreeSelectedIds([]);

      const nextDelivery = sessionResponse.data?.currentStop ?? orderedItems[0] ?? null;
      if (nextDelivery) {
        setSelectedDeliveryId(nextDelivery.id);
        prefetchOrderDetail(nextDelivery.id).catch(() => undefined);
      }

      startTransition(() => {
        router.push(buildDeliveriesHref('active-route'), { scroll: false });
      });

      toast.success(
        'המסלול התחיל',
        currentUser?.name
          ? `${orderedItems.length} משלוחים הוקצו ל-${currentUser.name}.`
          : `${orderedItems.length} משלוחים נקבעו למסלול מותאם.`
      );
    },
    [
      buildDeliveriesHref,
      currentUser?.id,
      currentUser?.name,
      deliveryTaskMutation,
      prefetchOrderDetail,
      router,
      selectedRouteDate,
      startSession,
      toast,
    ]
  );

  const dashboardPreviewRef = useRef(dashboardRoutePreview);
  dashboardPreviewRef.current = dashboardRoutePreview;

  const commitDashboardRoute = useCallback(async () => {
    const preview = dashboardPreviewRef.current;
    if (!preview) return;
    try {
      await finalizePlannedRoute(preview.orderedItems, preview.planResult);
      setDashboardRoutePreview(null);
      setDashboardPreviewSeconds(0);
    } catch (error) {
      toast.error('יצירת מסלול נכשלה', error instanceof Error ? error.message : undefined);
    }
  }, [finalizePlannedRoute, toast]);

  useEffect(() => {
    if (navigationHost !== 'dashboard') return;
    setDashboardRoutePreview(null);
    setFreeSelectedIds([]);
    setDashboardPreviewSeconds(0);
  }, [dashboardHubTab, navigationHost]);

  useEffect(() => {
    if (!dashboardRoutePreview || !useSimplifiedPlannerUi) {
      setDashboardPreviewSeconds(0);
      return;
    }

    setDashboardPreviewSeconds(5);
    const interval = window.setInterval(() => {
      setDashboardPreviewSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    const timeout = window.setTimeout(() => {
      const p = dashboardPreviewRef.current;
      if (!p) return;
      void (async () => {
        try {
          await finalizePlannedRoute(p.orderedItems, p.planResult);
          setDashboardRoutePreview(null);
          setDashboardPreviewSeconds(0);
        } catch (error) {
          toast.error('יצירת מסלול נכשלה', error instanceof Error ? error.message : undefined);
        }
      })();
    }, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [dashboardRoutePreview, finalizePlannedRoute, toast, useSimplifiedPlannerUi]);

  const handleStartFreeRoute = async () => {
    if (freeSelectedIds.length === 0 || isFreeRoutePending) return;
    setIsFreeRoutePending(true);

    try {
      const selectedItems = plannedActiveDeliveries.filter((d) => freeSelectedIds.includes(d.id));
      if (!selectedItems.length) return;

      const planResponse = await fetch('/api/mapbox/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sortMode: 'smart',
          origin,
          grouping: { strategy: 'none', workerCount: 1 },
          items: selectedItems.map((item) => ({
            id: item.id,
            number: item.number,
            customerName: item.customerName,
            status: item.status,
            addressLine: item.addressLine,
            city: item.city,
            scheduledAt: item.scheduledAt,
            serviceMinutes: DELIVERY_STOP_SERVICE_MINUTES,
            lat: item.lat,
            lng: item.lng,
          })),
        }),
      });

      if (!planResponse.ok) throw new Error('Failed to plan route');
      const planResult = (await planResponse.json()) as DeliveryPlanningResponse;

      const planItemsById = new Map((planResult.data?.items ?? []).map((pi) => [pi.id, pi]));
      const orderedIds = planResult.data?.route?.orderedIds ?? freeSelectedIds;
      const orderedItems: DeliveryBoardItem[] = [];
      for (const id of orderedIds) {
        const item = selectedItems.find((d) => d.id === id);
        const planItem = planItemsById.get(id);
        if (item) {
          orderedItems.push({
            ...item,
            lat: planItem?.lat ?? item.lat,
            lng: planItem?.lng ?? item.lng,
            etaMinutes: planItem?.etaMinutes ?? item.etaMinutes,
            distanceKm: planItem?.distanceKm ?? item.distanceKm,
            routeIndex: planItem?.routeIndex ?? item.routeIndex,
            estimatedArrivalAt: planItem?.estimatedArrivalAt ?? item.estimatedArrivalAt,
            estimatedCompletionAt: planItem?.estimatedCompletionAt ?? item.estimatedCompletionAt,
          });
        }
      }
      const orderedSet = new Set(orderedItems.map((d) => d.id));
      selectedItems.forEach((d) => {
        if (!orderedSet.has(d.id)) orderedItems.push(d);
      });

      if (useSimplifiedPlannerUi) {
        setDashboardRoutePreview({ orderedItems, planResult });
        return;
      }

      await finalizePlannedRoute(orderedItems, planResult);
    } catch (error) {
      toast.error('יצירת מסלול נכשלה', error instanceof Error ? error.message : undefined);
    } finally {
      setIsFreeRoutePending(false);
    }
  };

  const listErrorMessage = getFetchErrorMessage(error, t('deliveries.loadFailedBanner'));
  const activeDeliveriesTotal = allDeliveries.length;
  const mapboxAccessToken = mapboxConfigData?.data?.token ?? '';
  const mapboxStyleId = mapboxConfigData?.data?.styleId ?? 'mapbox/streets-v12';
  const routeSummary = planningData?.data?.summary;
  const routeGroupsRaw = useMemo(
    () => planningData?.data?.routeGroups ?? [],
    [planningData?.data?.routeGroups]
  );
  const deliveryById = useMemo(
    () => new Map(plannedActiveDeliveries.map((delivery) => [delivery.id, delivery])),
    [plannedActiveDeliveries]
  );
  const routeGroups = useMemo<DeliveryRouteGroupView[]>(
    () =>
      routeGroupsRaw.map((group) => {
        const items = group.items
          .map((item) => deliveryById.get(item.id))
          .filter((item): item is DeliveryBoardItem => Boolean(item));
        const cityLabels = Array.from(
          new Set(
            items
              .map((item) => item.city?.trim())
              .filter((value): value is string => Boolean(value))
          )
        ).slice(0, 3);
        const assignedWorkerNames = Array.from(
          new Set(
            items
              .map((item) => item.assignedUserName?.trim())
              .filter((value): value is string => Boolean(value))
          )
        );

        return {
          id: group.id,
          label: group.label,
          color: group.color,
          workerIndex: group.workerIndex,
          items,
          routeCoordinates: group.route?.coordinates ?? [],
          summary: group.summary,
          cityLabels,
          assignedWorkerName: assignedWorkerNames.length === 1 ? assignedWorkerNames[0] : null,
          leadDelivery: items[0] ?? null,
        };
      }),
    [deliveryById, routeGroupsRaw]
  );
  const todayPlannedActiveDeliveries = useMemo(
    () => plannedActiveDeliveries.filter((item) => item.routeBucket === 'today'),
    [plannedActiveDeliveries]
  );
  const routePanels = useMemo<DeliveryRouteGroupView[]>(() => {
    if (routeGroups.length > 0) {
      return routeGroups;
    }

    const items =
      todayPlannedActiveDeliveries.length > 0
        ? todayPlannedActiveDeliveries
        : plannedActiveDeliveries;
    if (!items.length) {
      return [];
    }

    const cityLabels = Array.from(
      new Set(
        items.map((item) => item.city?.trim()).filter((value): value is string => Boolean(value))
      )
    ).slice(0, 3);
    const assignedWorkerNames = Array.from(
      new Set(
        items
          .map((item) => item.assignedUserName?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
    const routeLabel = cityLabels.length > 0 ? `מסלול ${cityLabels[0]}` : 'מסלול יומי';

    return [
      {
        id: 'route-day-primary',
        label: routeLabel,
        color: PRIMARY_HEX_500,
        workerIndex: 1,
        items,
        routeCoordinates: planningData?.data?.route?.coordinates ?? [],
        summary: routeSummary
          ? {
              routeStopCount: routeSummary.routeStopCount,
              routeDurationMinutes: routeSummary.routeDurationMinutes,
              routeDistanceKm: routeSummary.routeDistanceKm,
              effectiveWorkloadMinutes: routeSummary.effectiveWorkloadMinutes,
            }
          : undefined,
        cityLabels,
        assignedWorkerName: assignedWorkerNames.length === 1 ? assignedWorkerNames[0] : null,
        leadDelivery: items[0] ?? null,
      },
    ];
  }, [
    plannedActiveDeliveries,
    planningData?.data?.route?.coordinates,
    routeGroups,
    routeSummary,
    todayPlannedActiveDeliveries,
  ]);

  useEffect(() => {
    if (activeSessionRouteGroupId) {
      autoRouteModeInitializedRef.current = true;
      if (screenMode === 'active-route') {
        setSelectedRouteGroupId(activeSessionRouteGroupId);
        setActiveExecutionRouteId(activeSessionRouteGroupId);
        setActiveTab('transit');
      }

      if (activeSessionCurrentStopId) {
        setSelectedDeliveryId(activeSessionCurrentStopId);
        prefetchOrderDetail(activeSessionCurrentStopId).catch(() => undefined);
      }
      return;
    }

    if (!currentUser?.id) {
      autoRouteModeInitializedRef.current = true;
      return;
    }

    if (!routePanels.length) {
      return;
    }

    if (!autoRouteModeInitializedRef.current) {
      autoRouteModeInitializedRef.current = true;
      setActiveExecutionRouteId(null);
      setActiveTab('pickup');
    }
  }, [
    activeSessionCurrentStopId,
    activeSessionId,
    activeSessionRouteGroupId,
    currentUser?.id,
    prefetchOrderDetail,
    routePanels,
    screenMode,
  ]);

  useEffect(() => {
    if (!routePanels.length) {
      setSelectedRouteGroupId(null);
      if (!activeSession) {
        setActiveExecutionRouteId(null);
      }
      return;
    }

    if (selectedRouteGroupId && !routePanels.some((group) => group.id === selectedRouteGroupId)) {
      setSelectedRouteGroupId(null);
    }

    if (
      activeExecutionRouteId &&
      !routePanels.some((group) => group.id === activeExecutionRouteId)
    ) {
      setActiveExecutionRouteId(null);
    }
  }, [activeExecutionRouteId, activeSession, routePanels, selectedRouteGroupId]);

  useEffect(() => {
    const validRouteItems = new Map(
      routePanels.map((group) => [group.id, new Set(group.items.map((item) => item.id))])
    );

    const pruneState = (prev: ChecklistStateByRouteId) => {
      const next: ChecklistStateByRouteId = {};

      validRouteItems.forEach((validIds, routeId) => {
        const entries = (prev[routeId] ?? []).filter((itemId) => validIds.has(itemId));
        if (entries.length > 0) {
          next[routeId] = entries;
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const hasSameShape =
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => (prev[key] ?? []).join('|') === (next[key] ?? []).join('|'));

      return hasSameShape ? prev : next;
    };

    setPickupChecklistByRouteId(pruneState);
    setArrivedStopIdsByRouteId(pruneState);
    setCompletedStopIdsByRouteId(pruneState);
    setDeferredStopIdsByRouteId(pruneState);
  }, [routePanels]);

  const persistedExecutionRouteGroup = useMemo(
    () => (activeSession ? deliverySessionToRouteGroup(activeSession) : null),
    [activeSession]
  );
  const effectiveRouteGroupId =
    activeSession?.routeGroup.id ?? activeExecutionRouteId ?? selectedRouteGroupId;
  const activeRouteGroup = useMemo(
    () =>
      persistedExecutionRouteGroup ??
      routePanels.find((group) => group.id === effectiveRouteGroupId) ??
      null,
    [effectiveRouteGroupId, persistedExecutionRouteGroup, routePanels]
  );

  const dashboardPreviewRouteGroup = useMemo((): DeliveryRouteGroupView | null => {
    if (!dashboardRoutePreview) return null;
    const items = dashboardRoutePreview.orderedItems;
    const summary = dashboardRoutePreview.planResult.data?.summary;
    const coords = dashboardRoutePreview.planResult.data?.route?.coordinates ?? [];
    const cities = Array.from(
      new Set(items.map((i) => i.city?.trim()).filter((v): v is string => Boolean(v)))
    ).slice(0, 3);

    return {
      id: 'dashboard-preview',
      label: cities.length ? cities.join(', ') : 'תצוגה מקדימה',
      // Mapbox paint props cannot resolve CSS variables
      color: ACCENT_HEX_500,
      workerIndex: 1,
      items,
      routeCoordinates: coords,
      summary: summary
        ? {
            routeStopCount: summary.routeStopCount ?? items.length,
            routeDurationMinutes: summary.routeDurationMinutes ?? null,
            routeDistanceKm: summary.routeDistanceKm ?? null,
            effectiveWorkloadMinutes: summary.effectiveWorkloadMinutes,
          }
        : undefined,
      cityLabels: cities,
      assignedWorkerName: null,
      leadDelivery: items[0] ?? null,
    };
  }, [dashboardRoutePreview]);

  const routeCards = useMemo(
    () =>
      activeExecutionRouteId
        ? routePanels.filter((group) => group.id === activeExecutionRouteId)
        : routePanels,
    [activeExecutionRouteId, routePanels]
  );

  const freeSelectableDeliveries = useMemo(
    () => plannedActiveDeliveries.filter((item) => !TRANSIT_STATUSES.has(item.status)),
    [plannedActiveDeliveries]
  );

  const selectedRouteItemIds = useMemo(
    () => new Set(activeRouteGroup?.items.map((item) => item.id) ?? []),
    [activeRouteGroup]
  );
  const scopedVisibleDeliveries = useMemo(
    () =>
      activeRouteGroup === null
        ? plannedDeliveries
        : plannedDeliveries.filter((item) => selectedRouteItemIds.has(item.id)),
    [activeRouteGroup, plannedDeliveries, selectedRouteItemIds]
  );
  const scopedMapDeliveries = useMemo(
    () =>
      activeRouteGroup === null
        ? plannedActiveDeliveries
        : plannedActiveDeliveries.filter((item) => selectedRouteItemIds.has(item.id)),
    [activeRouteGroup, plannedActiveDeliveries, selectedRouteItemIds]
  );

  useEffect(() => {
    if (!scopedVisibleDeliveries.length) {
      setSelectedDeliveryId(null);
      return;
    }

    const preferredOrderId = searchParams.get('orderId');
    const preferredExists =
      preferredOrderId && scopedVisibleDeliveries.some((item) => item.id === preferredOrderId);
    const currentExists =
      selectedDeliveryId && scopedVisibleDeliveries.some((item) => item.id === selectedDeliveryId);

    const nextSelectedId = preferredExists
      ? preferredOrderId
      : currentExists
        ? selectedDeliveryId
        : scopedVisibleDeliveries[0].id;

    if (!nextSelectedId) return;

    setSelectedDeliveryId(nextSelectedId);
  }, [scopedVisibleDeliveries, searchParams, selectedDeliveryId]);

  const mapSurfaceRouteGroup = dashboardPreviewRouteGroup ?? activeRouteGroup;
  const routeCoordinates =
    mapSurfaceRouteGroup?.routeCoordinates ?? planningData?.data?.route?.coordinates ?? [];
  const effectiveOrigin = origin ?? planningData?.data?.origin ?? null;
  const routeDurationLabel = formatDurationLabel(routeSummary?.routeDurationMinutes ?? null);
  const routeCapacityLabel = formatDurationLabel(routeSummary?.businessDayAvailableMinutes ?? null);
  const routeOperationalLimitLabel = formatDurationLabel(
    routeSummary?.operationalRouteLimitMinutes ?? null
  );
  const routeWorkloadLabel = formatDurationLabel(routeSummary?.effectiveWorkloadMinutes ?? null);
  const routeOverflowLabel = formatDurationLabel(routeSummary?.overflowMinutes ?? null);
  const routePreSplitWorkloadLabel = formatDurationLabel(
    routeSummary?.preSplitWorkloadMinutes ?? null
  );
  const deferredRouteWorkloadLabel = formatDurationLabel(
    routeSummary?.deferredWorkloadMinutes ?? null
  );
  const deferredDateLabel = routeSummary?.deferredDateKey
    ? new Date(`${routeSummary.deferredDateKey}T12:00:00`).toLocaleDateString('he-IL', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      })
    : null;
  const selectedRouteDateLabel = new Date(`${selectedRouteDate}T12:00:00`).toLocaleDateString(
    'he-IL',
    {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }
  );
  const originTimelineLabel =
    routeSummary?.originSource === 'user'
      ? 'מיקום נוכחי'
      : routeSummary?.originLabel || 'מחסן ראשי';
  const locationLabel =
    routeSummary?.originSource === 'user'
      ? 'ETA חי לפי המיקום שלך'
      : routeSummary?.originSource === 'store'
        ? `ETA לפי המחסן${routeSummary.originLabel ? ` • ${routeSummary.originLabel}` : ''}`
        : locationStatus === 'locating'
          ? 'מאתר מיקום...'
          : 'הגדר כתובת מחסן לחישוב ETA';
  const currentSortOption =
    SORT_OPTIONS.find((option) => option.id === sortMode) ?? SORT_OPTIONS[0];
  const hasActiveFilters = activeTab !== null;
  const isExecutionMode = Boolean(activeSession);
  const hasDeferredRoute = Boolean(
    routeSummary?.autoSplitApplied && routeSummary?.deferredStopCount
  );
  const routeGroupsAvailable = routePanels.length > 0;
  const multiRouteMode = splitStrategy === 'zones' && routeGroups.length > 0;
  const bundleSizeOptions =
    splitStrategy === 'zones'
      ? [
          { value: '2', label: '2 משלוחים במסלול' },
          { value: '3', label: '3 משלוחים במסלול' },
        ]
      : [{ value: '3', label: '3 משלוחים במסלול' }];
  const activeEtaCount =
    activeRouteGroup === null
      ? (routeSummary?.etaCount ?? 0)
      : activeRouteGroup.items.filter((item) => item.etaMinutes !== null).length;
  const activeGeocodedCount =
    activeRouteGroup === null
      ? (routeSummary?.geocodedCount ?? 0)
      : activeRouteGroup.items.filter((item) => item.geocodeSource === 'mapbox').length;
  const activeRouteDurationLabel =
    activeRouteGroup === null
      ? routeDurationLabel
      : formatDurationLabel(activeRouteGroup.summary?.routeDurationMinutes ?? null);
  const activeRouteDistanceLabel = formatDistanceLabel(
    activeRouteGroup?.summary?.routeDistanceKm ?? routeSummary?.routeDistanceKm ?? null
  );
  const activeWorkloadLabel =
    activeRouteGroup === null
      ? routeWorkloadLabel
      : formatDurationLabel(
          activeRouteGroup.summary?.effectiveWorkloadMinutes ??
            activeRouteGroup.summary?.routeDurationMinutes ??
            null
        );
  const activeRouteCountLabel = `${activeRouteGroup?.summary?.routeStopCount ?? scopedMapDeliveries.length} עצירות`;
  const activeRouteArrivedIds = useMemo(
    () =>
      new Set(
        activeSession?.arrivedOrderIds ??
          (activeRouteGroup ? (arrivedStopIdsByRouteId[activeRouteGroup.id] ?? []) : [])
      ),
    [activeRouteGroup, activeSession?.arrivedOrderIds, arrivedStopIdsByRouteId]
  );
  const activeRouteCompletedIds = useMemo(
    () =>
      new Set(
        activeSession?.completedOrderIds ??
          (activeRouteGroup ? (completedStopIdsByRouteId[activeRouteGroup.id] ?? []) : [])
      ),
    [activeRouteGroup, activeSession?.completedOrderIds, completedStopIdsByRouteId]
  );
  const activeRouteDeferredIds = useMemo(
    () =>
      new Set(
        activeSession?.deferredOrderIds ??
          (activeRouteGroup ? (deferredStopIdsByRouteId[activeRouteGroup.id] ?? []) : [])
      ),
    [activeRouteGroup, activeSession?.deferredOrderIds, deferredStopIdsByRouteId]
  );
  const activeExecutionStops = useMemo(() => {
    if (activeSession) {
      const persistedStops = new Map(deliverySessionToRouteGroup(activeSession).items.map((item) => [item.id, item]));
      return activeSession.queue.flatMap((item) => { const stop = persistedStops.get(item.id); return stop ? [stop] : []; });
    }

    if (activeRouteGroup === null) {
      return [];
    }

    const pendingStops = activeRouteGroup.items.filter(
      (item) => !activeRouteCompletedIds.has(item.id)
    );
    const immediateStops = pendingStops.filter((item) => !activeRouteDeferredIds.has(item.id));
    const deferredStops = pendingStops.filter((item) => activeRouteDeferredIds.has(item.id));
    return [...immediateStops, ...deferredStops];
  }, [activeRouteCompletedIds, activeRouteDeferredIds, activeRouteGroup, activeSession]);
  const executionNextDelivery = activeExecutionStops[0] ?? null;
  const executionFollowingDelivery = activeExecutionStops[1] ?? null;
  const executionQueuedDeliveries = activeExecutionStops.slice(1, 5);

  const fieldExecutionGroup = dashboardPreviewRouteGroup ?? activeRouteGroup;
  const fieldRouteDurationLabel = dashboardPreviewRouteGroup
    ? formatDurationLabel(
        dashboardRoutePreview?.planResult.data?.summary?.routeDurationMinutes ?? null
      )
    : activeRouteDurationLabel;
  const fieldRouteDistanceLabel = dashboardPreviewRouteGroup
    ? formatDistanceLabel(
        dashboardRoutePreview?.planResult.data?.summary?.routeDistanceKm ?? null
      )
    : activeRouteDistanceLabel;
  const fieldRouteCountLabel = dashboardPreviewRouteGroup
    ? `${dashboardPreviewRouteGroup.items.length} עצירות`
    : activeRouteCountLabel;
  const fieldOverviewStops = dashboardPreviewRouteGroup
    ? dashboardPreviewRouteGroup.items
    : activeExecutionStops;

  const fieldExecutionNextDelivery = dashboardPreviewRouteGroup
    ? fieldOverviewStops[0] ?? null
    : executionNextDelivery;
  const fieldExecutionFollowingDelivery = dashboardPreviewRouteGroup
    ? fieldOverviewStops[1] ?? null
    : executionFollowingDelivery;
  const fieldExecutionQueuedDeliveries = dashboardPreviewRouteGroup
    ? fieldOverviewStops.slice(1, 5)
    : executionQueuedDeliveries;

  const activeRouteTotalItemsCount =
    activeRouteGroup?.items.reduce((sum, item) => sum + (item.itemsCount ?? 1), 0) ?? 0;
  const activeRouteCompletedCount = activeSession
    ? activeSession.completedOrderIds.length
    : activeRouteGroup
      ? activeRouteGroup.items.length - activeExecutionStops.length
      : 0;
  const executionNextArrived = executionNextDelivery
    ? activeRouteArrivedIds.has(executionNextDelivery.id)
    : false;
  const executionNextDeferred = executionNextDelivery
    ? activeRouteDeferredIds.has(executionNextDelivery.id)
    : false;
  const executionProgressPercent =
    activeRouteGroup && activeRouteGroup.items.length > 0
      ? Math.round((activeRouteCompletedCount / activeRouteGroup.items.length) * 100)
      : 0;
  const defaultWorkerByGroupId = useMemo(() => {
    const defaults: Record<string, string> = {};

    routePanels.forEach((group) => {
      const assignedIds = Array.from(
        new Set(
          group.items
            .map((item) => deliveryById.get(item.id)?.assignedUserId ?? null)
            .filter((value): value is string => Boolean(value))
        )
      );

      if (assignedIds.length === 1) {
        defaults[group.id] = assignedIds[0];
      }
    });

    return defaults;
  }, [deliveryById, routePanels]);

  useEffect(() => {
    setSelectedWorkerByGroupId((prev) => {
      const next: Record<string, string> = {};

      routePanels.forEach((group) => {
        const persisted = prev[group.id];
        if (persisted) {
          next[group.id] = persisted;
          return;
        }

        const defaultWorker = defaultWorkerByGroupId[group.id];
        if (defaultWorker) {
          next[group.id] = defaultWorker;
          return;
        }

        if (currentUser?.id) {
          next[group.id] = currentUser.id;
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const hasSameShape =
        prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key]);

      return hasSameShape ? prev : next;
    });
  }, [currentUser?.id, defaultWorkerByGroupId, routePanels]);

  return (
    <div
      className={cn(
        screenMode === 'overview' ? 'min-h-full space-y-3 pb-24' : 'h-screen w-full overflow-hidden'
      )}
      dir={direction}
      suppressHydrationWarning
    >
      {screenMode === 'overview' ? (
        <OpsCompactHeader
          title={t('deliveries.title')}
          subtitle={
            mounted ? (
              useSimplifiedPlannerUi ? (
                <>
                  <span>
                    {navigationHost === 'dashboard' && dashboardHubTab === 'future'
                      ? 'מחר עד סוף השבוע (משלוחים מתוזמנים)'
                      : navigationHost === 'dashboard'
                        ? 'משלוחים פעילים — קיבוץ לפי אזור, בחירה ומסלול אופטימלי'
                        : 'בחירה לפי אזור • תצוגת מסלול • יציאה לשטח'}
                  </span>
                  {navigationHost !== 'dashboard' ? (
                    <>
                      <span className="text-ops-icon-muted">•</span>
                      <span>{selectedRouteDateLabel}</span>
                    </>
                  ) : null}
                  <span className="text-ops-icon-muted">•</span>
                  <span>{activeDeliveriesTotal} הזמנות ברשימה</span>
                  <span className="text-ops-icon-muted">•</span>
                  <span>{locationLabel}</span>
                </>
              ) : (
                <>
                  <span>מסלול חלוקה יומי</span>
                  <span className="text-ops-icon-muted">•</span>
                  <span>{selectedRouteDateLabel}</span>
                  <span className="text-ops-icon-muted">•</span>
                  <span>{activeDeliveriesTotal} הזמנות ליום הזה</span>
                  {currentTab ? <span className="text-ops-icon-muted">•</span> : null}
                  {currentTab ? (
                    <span>{resolveLabel(currentTab.labelKey, currentTab.fallback)}</span>
                  ) : null}
                  {activeRouteGroup ? <span className="text-ops-icon-muted">•</span> : null}
                  {activeRouteGroup ? <span>{activeRouteGroup.label}</span> : null}
                  <span className="text-ops-icon-muted">•</span>
                  <span>{locationLabel}</span>
                </>
              )
            ) : null
          }
          actions={
            <div className="flex items-center gap-2">
              {!useSimplifiedPlannerUi ? (
                <>
                  <div className="hidden md:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'h-10 gap-1.5 rounded-full border-subtle bg-surface px-3 text-sm font-black text-fg shadow-sm hover:bg-surface-muted transition-colors',
                            activeTab && 'border-primary-500/30 bg-primary-500/5 text-primary-600'
                          )}
                        >
                          <Clock3
                            className={cn(
                              'h-4 w-4 shrink-0',
                              activeTab ? 'text-brand' : 'text-ops-muted'
                            )}
                          />
                          <span className="hidden xl:inline-block max-w-[100px] truncate">
                            {currentTab
                              ? resolveLabel(currentTab.labelKey, currentTab.fallback)
                              : 'שלבים'}
                          </span>
                          {activeTab && (
                            <span className="rounded-full bg-surface-highlight px-1.5 py-0.5 text-[11px] font-black text-brand">
                              {tabCounts.get(activeTab) ?? 0}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[280px]">
                        <DropdownMenuLabel className="font-black text-fg-muted text-[11px] uppercase tracking-wider">
                          שלב שילוח
                        </DropdownMenuLabel>
                        {DELIVERY_TABS.map((tab) => {
                          const count = tabCounts.get(tab.id) ?? 0;
                          const label = resolveLabel(tab.labelKey, tab.fallback);
                          const hint =
                            tab.id === 'pickup'
                              ? 'הזמנות מוכנות לאיסוף וליציאה'
                              : 'משלוחים שכבר נמצאים בביצוע';

                          return (
                            <DropdownMenuCheckboxItem
                              key={tab.id}
                              checked={activeTab === tab.id}
                              onCheckedChange={() => handleTabChange(tab.id)}
                              className="items-start py-3"
                            >
                              <div className="flex w-full min-w-0 items-start justify-between gap-3 font-bold">
                                <div className="min-w-0">
                                  <div className="text-sm text-fg">{label}</div>
                                  <div className="mt-1 text-[11px] font-medium text-ops-muted">
                                    {hint}
                                  </div>
                                </div>
                                <span className="rounded-full bg-surface-highlight px-2 py-0.5 text-[11px] font-black text-brand">
                                  {count}
                                </span>
                              </div>
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                        {activeTab ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => handleTabChange(activeTab as DeliveryTabId)}
                              className="font-bold text-danger"
                            >
                              נקה פילטר
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="hidden md:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 gap-1.5 rounded-full border-subtle bg-surface px-3 text-sm font-black text-fg shadow-sm hover:bg-surface-muted transition-colors"
                        >
                          <currentSortOption.icon className="h-4 w-4 shrink-0 text-brand" />
                          <span className="max-w-[100px] truncate">{currentSortOption.label}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-[1051] w-[240px]">
                        <DropdownMenuLabel className="font-black text-fg-muted text-[11px] uppercase tracking-wider">
                          מיון רשימה
                        </DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={sortMode}
                          onValueChange={(value) => setSortMode(value as DeliverySortMode)}
                        >
                          {SORT_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.id}
                              value={option.id}
                              className="font-bold py-3"
                            >
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4 text-brand" />
                                <span className="text-fg">{option.label}</span>
                              </div>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="hidden items-center gap-2 lg:flex">
                    <div className="flex items-center gap-2 rounded-full border border-subtle bg-surface px-2 py-1 shadow-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleShiftRouteDate(-1)}
                        className="h-8 w-8 rounded-full p-0 text-brand hover:bg-primary-500/10"
                        title="יום קודם"
                        aria-label="יום קודם"
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">יום קודם</span>
                      </Button>
                      <Input
                        type="date"
                        value={selectedRouteDate}
                        onChange={(event) => handleRouteDateChange(event.target.value)}
                        aria-label="תאריך מסלול"
                        className="h-10 w-[156px] rounded-full border-subtle bg-surface px-3 text-sm font-black text-fg"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleShiftRouteDate(1)}
                        className="h-8 w-8 rounded-full p-0 text-brand hover:bg-primary-500/10"
                        title="יום הבא"
                        aria-label="יום הבא"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">יום הבא</span>
                      </Button>
                    </div>
                    <Select
                      value={splitStrategy}
                      onValueChange={handleSplitStrategyChange}
                      aria-label="סוג חלוקה"
                      className="h-10 min-w-[150px] rounded-full border-subtle bg-surface px-3 text-sm font-black text-fg"
                      options={[
                        { value: 'none', label: 'מסלול אחד' },
                        { value: 'zones', label: 'חלוקה חכמה' },
                      ]}
                    />
                    <Select
                      value={workerCount}
                      onValueChange={(value) => setWorkerCount(value)}
                      disabled={splitStrategy === 'none'}
                      aria-label="גודל מסלול"
                      className="h-10 min-w-[150px] rounded-full border-subtle bg-surface px-3 text-sm font-black text-fg"
                      options={bundleSizeOptions}
                    />
                  </div>

                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearFilters}
                      className="h-10 px-3 rounded-full text-danger hover:bg-danger-soft hover:text-danger text-sm font-bold"
                    >
                      נקה
                    </Button>
                  ) : null}

                  <div className="mx-1 hidden h-6 w-px bg-divider md:block" />
                </>
              ) : null}

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBoardInfo((value) => !value)}
                className="h-10 shrink-0 rounded-full border-subtle bg-surface px-3 text-xs font-black text-brand shadow-sm hover:bg-surface-muted"
              >
                {showBoardInfo ? 'הסתר מדדים' : 'מדדים'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={requestOriginLocation}
                className="hidden h-10 w-10 p-0 rounded-full border-subtle bg-surface text-brand shadow-sm hover:bg-surface-muted md:inline-flex"
                aria-label={
                  routeSummary?.originSource === 'user' ? 'מיקום נוכחי פעיל' : 'השתמש במיקום נוכחי'
                }
              >
                <LocateFixed
                  className={cn('h-4 w-4', locationStatus === 'locating' && 'animate-pulse')}
                />
                <span className="sr-only">
                  {routeSummary?.originSource === 'user'
                    ? 'מיקום נוכחי פעיל'
                    : 'השתמש במיקום נוכחי'}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRefresh()}
                className="h-10 w-10 p-0 rounded-full border-subtle bg-surface text-brand shadow-sm hover:bg-surface-muted"
                title="רענן"
                aria-label="רענן"
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    (isLoading || isFetching || planningFetching) && 'animate-spin'
                  )}
                />
                <span className="sr-only">רענן</span>
              </Button>
            </div>
          }
        >
          <div
            className={cn(
              'mt-2 grid gap-2',
              useSimplifiedPlannerUi ? '' : 'lg:hidden'
            )}
          >
            <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-surface/90 p-2 shadow-sm ring-1 ring-[color:var(--color-border-primary)]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleShiftRouteDate(-1)}
                className="h-9 w-9 shrink-0 rounded-full p-0 text-brand hover:bg-primary-500/10"
                title="יום קודם"
                aria-label="יום קודם"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedRouteDate}
                onChange={(event) => handleRouteDateChange(event.target.value)}
                aria-label="תאריך מסלול"
                className="h-11 min-w-0 flex-1 rounded-2xl border-0 bg-surface-muted/50 px-4 text-sm font-black text-fg ring-1 ring-[color:var(--color-border-primary)]"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleShiftRouteDate(1)}
                className="h-9 w-9 shrink-0 rounded-full p-0 text-brand hover:bg-primary-500/10"
                title="יום הבא"
                aria-label="יום הבא"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className={cn('relative', useSimplifiedPlannerUi ? 'mt-2' : 'mt-2 lg:mt-0')}>
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ops-icon-muted" />
            <Input
              placeholder="חיפוש משלוח, לקוח או יעד"
              aria-label="חיפוש משלוח, לקוח או יעד"
              className="h-11 rounded-full border-0 bg-surface/90 pr-11 text-sm text-fg shadow-sm ring-1 ring-[color:var(--color-border-primary)] transition-shadow focus:shadow-md focus:shadow-primary-500/15"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ops-icon-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </OpsCompactHeader>
      ) : null}

      {screenMode === 'overview' ? (
        <div
          className={cn(
            'grid gap-4',
            isExecutionMode ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]'
          )}
        >
          <PickupBoard
            allPickupDeliveries={freeSelectableDeliveries}
            freeSelectedIds={freeSelectedIds}
            freeSelectionMode={freeSelectionMode}
            isFreeRoutePending={isFreeRoutePending}
            hideSystemRouteRows={useSimplifiedPlannerUi}
            emptyQueueLabel={
              navigationHost === 'dashboard' && dashboardHubTab === 'future'
                ? 'אין משלוחים מתוזמנים להמשך השבוע'
                : null
            }
            dashboardPreviewSeconds={dashboardPreviewSeconds}
            onCancelDashboardPreview={() => {
              setDashboardRoutePreview(null);
              setDashboardPreviewSeconds(0);
            }}
            onCommitDashboardRoute={() => void commitDashboardRoute()}
            routePlanPrimaryLabel={useSimplifiedPlannerUi ? 'תצוגה מקדימה ומסלול' : undefined}
            onStartFreeRoute={() => void handleStartFreeRoute()}
            onToggleFreeDelivery={handleToggleFreeDelivery}
            onToggleFreeSelectionMode={handleToggleFreeSelectionMode}
            activeEtaCount={activeEtaCount}
            activeGeocodedCount={activeGeocodedCount}
            activeRouteCountLabel={activeRouteCountLabel}
            activeRouteDistanceLabel={activeRouteDistanceLabel}
            activeRouteDurationLabel={activeRouteDurationLabel}
            activeRouteGroup={activeRouteGroup}
            activeWorkloadLabel={activeWorkloadLabel}
            assignPending={assignGroupMutation.isPending || isStartingSession}
            completedStopIdsByRouteId={completedStopIdsByRouteId}
            currentUserId={currentUser?.id ?? null}
            currentUserName={currentUser?.name ?? null}
            deferredDateLabel={deferredDateLabel}
            deferredRouteWorkloadLabel={deferredRouteWorkloadLabel}
            deliveryTaskPending={deliveryTaskMutation.isPending || isUpdatingSession}
            errorMessage={error ? listErrorMessage : null}
            hasDeferredRoute={hasDeferredRoute}
            isExecutionMode={isExecutionMode}
            isStatusChanging={(orderId) =>
              statusMutation.isPending && statusMutation.variables?.orderId === orderId
            }
            mounted={mounted}
            multiRouteMode={multiRouteMode}
            onClearRouteGroupFocus={handleClearRouteGroupFocus}
            onMarkDelivered={(orderId) => void changeStatus(orderId, 'COMPLETED')}
            onSelectDelivery={handleSelectDelivery}
            onSelectRouteGroup={handleSelectRouteGroup}
            onStartDelivery={(orderId) => void changeStatus(orderId, 'IN_TRANSIT')}
            onTakeRoute={(groupId) => void handleTakeRoute(groupId)}
            onTogglePickupItem={handleTogglePickupItem}
            originTimelineLabel={originTimelineLabel}
            pickupChecklistByRouteId={pickupChecklistByRouteId}
            plannedActiveDeliveriesCount={plannedActiveDeliveries.length}
            routeCapacityLabel={routeCapacityLabel}
            routeCards={routeCards}
            routeGroupsAvailable={routeGroupsAvailable}
            routeOperationalLimitLabel={routeOperationalLimitLabel}
            routePanelsCount={routePanels.length}
            routePreSplitWorkloadLabel={routePreSplitWorkloadLabel}
            routeSummaryBusinessHoursLabel={routeSummary?.businessHoursLabel ?? null}
            routeSummaryDeferredStopCount={routeSummary?.deferredStopCount ?? 0}
            routeSummaryExceedsBusinessHours={Boolean(routeSummary?.exceedsBusinessHours)}
            routeSummaryExceedsOperationalLimit={Boolean(routeSummary?.exceedsOperationalLimit)}
            routeSummaryOverflowLabel={
              formatDurationLabel(
                routeSummary?.operationalOverflowMinutes ?? routeSummary?.overflowMinutes ?? null
              ) ??
              routeOverflowLabel ??
              'לא חושב'
            }
            routeWorkloadLabel={routeWorkloadLabel}
            scopedVisibleDeliveries={scopedVisibleDeliveries}
            selectedDeliveryId={selectedDeliveryId}
            selectedRouteDateLabel={selectedRouteDateLabel}
            showBoardInfo={showBoardInfo}
          />

          <FieldExecutionScreen
            activeRouteGroup={fieldExecutionGroup}
            activeRouteCountLabel={fieldRouteCountLabel}
            activeRouteDistanceLabel={fieldRouteDistanceLabel}
            activeRouteDurationLabel={fieldRouteDurationLabel}
            activeRouteCompletedCount={activeRouteCompletedCount}
            activeRouteTotalItemsCount={activeRouteTotalItemsCount}
            currentUserName={currentUser?.name ?? null}
            executionFollowingDelivery={fieldExecutionFollowingDelivery}
            executionNextArrived={executionNextArrived}
            executionNextDeferred={executionNextDeferred}
            executionNextDelivery={fieldExecutionNextDelivery}
            executionProgressPercent={executionProgressPercent}
            executionQueuedDeliveries={fieldExecutionQueuedDeliveries}
            executionRemainingStops={fieldOverviewStops}
            isExecutionMode={isExecutionMode}
            isMutating={
              statusMutation.isPending ||
              deliveryTaskMutation.isPending ||
              isUpdatingSession ||
              isStartingSession
            }
            liveLocation={liveLocation}
            mapboxAccessToken={mapboxAccessToken}
            mapboxStyleId={mapboxStyleId}
            onCompleteNextStop={() => void handleCompleteNextStop()}
            onDeferNextStop={(reason) =>
              executionNextDelivery && activeRouteGroup
                ? void handleDeferNextStop(activeRouteGroup.id, executionNextDelivery.id, reason)
                : undefined
            }
            onMarkArrival={() =>
              executionNextDelivery && activeRouteGroup
                ? void handleMarkArrival(activeRouteGroup.id, executionNextDelivery.id)
                : undefined
            }
            onOpenOrder={() =>
              executionNextDelivery ? handleSelectDelivery(executionNextDelivery) : undefined
            }
            onReleaseExecution={() => void handleReleaseExecution()}
            origin={effectiveOrigin}
            originTimelineLabel={originTimelineLabel}
            routeCoordinates={routeCoordinates}
            trackingStatus={trackingStatus}
          />
        </div>
      ) : (
        <FieldExecutionScreen
          activeRouteGroup={activeRouteGroup}
          activeRouteCountLabel={activeRouteCountLabel}
          activeRouteDistanceLabel={activeRouteDistanceLabel}
          activeRouteDurationLabel={activeRouteDurationLabel}
          activeRouteCompletedCount={activeRouteCompletedCount}
          activeRouteTotalItemsCount={activeRouteTotalItemsCount}
          currentUserName={currentUser?.name ?? null}
          executionFollowingDelivery={executionFollowingDelivery}
          executionNextArrived={executionNextArrived}
          executionNextDeferred={executionNextDeferred}
          executionNextDelivery={executionNextDelivery}
          executionProgressPercent={executionProgressPercent}
          executionQueuedDeliveries={executionQueuedDeliveries}
          executionRemainingStops={activeExecutionStops}
          isExecutionMode={isExecutionMode}
          isMutating={
            statusMutation.isPending ||
            deliveryTaskMutation.isPending ||
            isUpdatingSession ||
            isStartingSession
          }
          liveLocation={liveLocation}
          mapboxAccessToken={mapboxAccessToken}
          mapboxStyleId={mapboxStyleId}
          onCompleteNextStop={() => void handleCompleteNextStop()}
          onDeferNextStop={(reason) =>
            executionNextDelivery && activeRouteGroup
              ? void handleDeferNextStop(activeRouteGroup.id, executionNextDelivery.id, reason)
              : undefined
          }
          onMarkArrival={() =>
            executionNextDelivery && activeRouteGroup
              ? void handleMarkArrival(activeRouteGroup.id, executionNextDelivery.id)
              : undefined
          }
          onOpenOrder={() =>
            executionNextDelivery ? handleSelectDelivery(executionNextDelivery) : undefined
          }
          onReleaseExecution={() => void handleReleaseExecution()}
          origin={effectiveOrigin}
          originTimelineLabel={originTimelineLabel}
          routeCoordinates={routeCoordinates}
          trackingStatus={trackingStatus}
        />
      )}

      <DeliveryOpsFloatingModal
        open={!!modalOrderId}
        onOpenChange={(open) => {
          if (!open) {
            setModalOrderId(null);
            void refetch();
          }
        }}
        orderId={modalOrderId}
      />
    </div>
  );
}

