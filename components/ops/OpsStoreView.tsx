'use client';

import {
  OpsBoardSurface,
  OpsCompactHeader,
  OpsDisclosurePanel,
} from '@/components/ops/shared/OpsBoardPrimitives';
import {
  OpsStoreFloatingNav,
  OpsStoreMiniCard,
  OpsStoreSignal,
} from '@/components/ops/store/OpsStorePrimitives';
import { OrderStatusBadge } from '@/components/orders/shared/OrderStatusBadge';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import type { ProductDTO } from '@/domain/products/productDTO';
import { normalizeUsers } from '@/domain/users/normalizeUser';
import { useRBAC } from '@/hooks/useRBAC';
import apiClient from '@/lib/apiClient';
import { useOrdersQuery, useOrdersStatusDashboardQuery } from '@/lib/hooks/api/orders';
import { useProductsQuery } from '@/lib/hooks/api/products';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  PackageSearch,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { startTransition, useMemo, useState, type ReactNode } from 'react';

type StoreTabId = 'orders' | 'employees' | 'inventory' | 'calendar' | 'settings';

const STORE_TABS: Array<{
  id: StoreTabId;
  label: string;
  icon: typeof ShoppingCart;
}> = [
  { id: 'orders', label: 'הזמנות', icon: ShoppingCart },
  { id: 'employees', label: 'עובדים', icon: Users },
  { id: 'inventory', label: 'מלאי', icon: Boxes },
  { id: 'calendar', label: 'יומן', icon: CalendarDays },
  { id: 'settings', label: 'הגדרות', icon: Settings2 },
];

const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'RECEIVED',
  'PROCESSING',
  'READY',
  'TO_DO',
  'CALL_BACK',
];
const DELIVERY_FLOW_STATUSES: OrderStatus[] = [
  'READY_FOR_INSTALL',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
];
const PROCUREMENT_STATUSES: OrderStatus[] = ['PO_CREATED', 'AWAITING_STOCK', 'PARTIALLY_SUPPLIED'];
const COMPLETED_STATUSES: OrderStatus[] = ['COMPLETED', 'SUPPLIED', 'INVOICED', 'INSTALLED'];

const StoreSettingsWorkspace = dynamic(
  () =>
    import('@/components/settings/StoreSettingsWorkspace').then((module) => ({
      default: module.StoreSettingsWorkspace,
    })),
  {
    loading: () => (
      <div className="flex min-h-[220px] items-center justify-center rounded-[26px] border border-dashed border-surface-soft bg-surface-translucent text-sm font-medium text-fg-muted">
        טוען הגדרות חנות
      </div>
    ),
  }
);

function formatTodayLabel(locale: string) {
  return new Intl.DateTimeFormat(locale || 'he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

function formatDateTime(dateValue: Date | string | null | undefined, locale: string) {
  if (!dateValue) return 'ללא זמן';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'ללא זמן';

  return new Intl.DateTimeFormat(locale || 'he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getProductStock(product: ProductDTO) {
  return product.stockUnits ?? product.demoStock ?? 0;
}

function getCountByStatuses(
  summary: Array<{ status: string; count: number }> | undefined,
  statuses: readonly string[]
) {
  if (!summary?.length) return 0;
  const target = new Set(statuses);
  let total = 0;
  for (const row of summary) {
    if (target.has(row.status)) total += row.count;
  }
  return total;
}

async function fetchStoreUsers() {
  const response = await apiClient.get<any[]>('/api/users');
  if (!response.success) {
    throw new Error(response.error?.message || 'שגיאה בטעינת משתמשים');
  }

  return normalizeUsers(Array.isArray(response.data) ? response.data : []);
}

export function OpsStoreView() {
  const { direction, locale } = useUITranslation();
  const { user, isAdmin } = useRBAC();

  const [activeTab, setActiveTab] = useState<StoreTabId>('orders');
  const [showSecondaryLinks, setShowSecondaryLinks] = useState(false);

  const { data: ordersStatus } = useOrdersStatusDashboardQuery();
  const statusSummary = useMemo(() => ordersStatus?.summary ?? [], [ordersStatus?.summary]);

  const { data: recentOrdersData, isLoading: recentOrdersLoading } = useOrdersQuery({
    filters: {
      limit: 4,
      sort: 'updatedAt',
      dir: 'desc',
    },
    enabled: activeTab === 'orders',
    options: {
      staleTime: 45_000,
    },
  });

  const { data: scheduleOrdersData, isLoading: scheduleOrdersLoading } = useOrdersQuery({
    filters: {
      status: DELIVERY_FLOW_STATUSES,
      limit: 4,
      sort: 'updatedAt',
      dir: 'desc',
    },
    enabled: activeTab === 'calendar',
    options: {
      staleTime: 45_000,
    },
  });

  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
  } = useProductsQuery({
    filters: {
      limit: 120,
    },
    enabled: activeTab === 'inventory',
    options: {
      staleTime: 60_000,
    },
  });

  const {
    data: teamMembers = [],
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery({
    queryKey: ['store', 'users'],
    queryFn: fetchStoreUsers,
    enabled: isAdmin && activeTab === 'employees',
    staleTime: 60_000,
    retry: false,
  });

  const openOrdersCount = useMemo(
    () => getCountByStatuses(statusSummary, OPEN_ORDER_STATUSES),
    [statusSummary]
  );
  const deliveryFlowCount = useMemo(
    () => getCountByStatuses(statusSummary, DELIVERY_FLOW_STATUSES),
    [statusSummary]
  );
  const procurementCount = useMemo(
    () => getCountByStatuses(statusSummary, PROCUREMENT_STATUSES),
    [statusSummary]
  );
  const completedCount = useMemo(
    () => getCountByStatuses(statusSummary, COMPLETED_STATUSES),
    [statusSummary]
  );

  const recentOrders = recentOrdersData?.items ?? [];
  const latestOrder = recentOrders[0];

  const deliveryFocusOrders = scheduleOrdersData?.items ?? [];
  const nextScheduledOrder = deliveryFocusOrders[0];

  const products = productsData?.items ?? [];
  const activeProducts = products.filter((product) => product.isActive);
  const outOfStockProducts = products.filter((product) => getProductStock(product) <= 0);
  const lowStockProducts = products.filter((product) => {
    const stock = getProductStock(product);
    const threshold = Math.max(product.reorderLevel ?? 0, 3);
    return stock <= threshold;
  });

  const lowStockSummary = lowStockProducts
    .slice(0, 2)
    .map((product) => product.name)
    .join(' • ');

  const activeTeamMembers = teamMembers.filter((member) => member.isActive);
  const loadedTeamMembers = activeTeamMembers.length > 0 ? activeTeamMembers : teamMembers;
  const membersWithLoad = loadedTeamMembers.filter((member) => member.assignedOrdersCount > 0);
  const teamAssignments = loadedTeamMembers.reduce(
    (sum, member) => sum + member.assignedOrdersCount,
    0
  );
  const adminCount = loadedTeamMembers.filter((member) => member.role.key === 'ADMIN').length;

  const activeTabLabel = STORE_TABS.find((tab) => tab.id === activeTab)?.label ?? 'ניהול';
  const todayLabel = formatTodayLabel(locale);

  const activeCountLabel = useMemo(() => {
    switch (activeTab) {
      case 'orders':
        return `${openOrdersCount} פתוחות`;
      case 'employees':
        return isAdmin ? `${loadedTeamMembers.length} עובדים` : 'מנהל בלבד';
      case 'inventory':
        return products.length ? `${products.length} פריטים` : 'קטלוג';
      case 'calendar':
        return `${deliveryFlowCount} משימות פעילות`;
      case 'settings':
        return 'חנות, מוצא מסלולים ותפעול';
      default:
        return undefined;
    }
  }, [
    activeTab,
    deliveryFlowCount,
    isAdmin,
    loadedTeamMembers.length,
    openOrdersCount,
    products.length,
  ]);

  const renderOrdersPanel = () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <OpsStoreMiniCard
        icon={ClipboardList}
        title="פתוחות עכשיו"
        subtitle="הזמנות שעדיין בטיפול"
        value={openOrdersCount}
        tone="primary"
      />
      <OpsStoreMiniCard
        icon={Truck}
        title="בזרימת מסירה"
        subtitle="תיאום, יציאה או ביצוע"
        value={deliveryFlowCount}
        tone="warning"
      />
      <OpsStoreMiniCard
        icon={Clock3}
        title={latestOrder ? `#${latestOrder.number}` : 'הזמנה אחרונה'}
        subtitle={
          latestOrder ? (
            <div className="space-y-1">
              <div>{latestOrder.customerName || latestOrder.customer?.name || DISPLAY_TEXT.unknownCustomer}</div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge
                  status={normalizeOrderStatus(latestOrder.status)}
                  size="sm"
                  className="!px-2 !py-0.5"
                />
                <span>{formatDateTime(latestOrder.updatedAt, locale)}</span>
              </div>
            </div>
          ) : recentOrdersLoading ? (
            'טוען הזמנות אחרונות'
          ) : (
            'אין הזמנות להצגה'
          )
        }
        value={latestOrder ? `₪${Math.round((latestOrder.totalCents ?? 0) / 100)}` : '...'}
        tone="neutral"
        href={latestOrder ? `/orders/${latestOrder.id}` : '/orders'}
      />
      <OpsStoreMiniCard
        icon={ShoppingCart}
        title="ניהול הזמנות"
        subtitle="פתיחת לוח ההזמנות והמשלוחים"
        tone="success"
        href="/orders"
      />
    </div>
  );

  const renderEmployeesPanel = () => {
    if (!isAdmin) {
      return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OpsStoreMiniCard
            icon={ShieldCheck}
            title="עובדים"
            subtitle="נתוני עובדים מלאים זמינים למנהל"
            value="מוגבל"
            tone="warning"
          />
          <OpsStoreMiniCard
            icon={Users}
            title={user?.name || 'המשתמש הנוכחי'}
            subtitle="גישה מהירה לתפעול היומי"
            value={typeof user?.role === 'object' ? user.role.label : user?.role || 'OPERATIONS'}
            tone="neutral"
          />
          <OpsStoreMiniCard
            icon={ShoppingCart}
            title="המשך לעבודה"
            subtitle="פתח את לוח ההזמנות הפעיל"
            tone="primary"
            href="/orders"
          />
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OpsStoreMiniCard
          icon={Users}
          title="פעילים במערכת"
          subtitle={teamLoading ? 'טוען צוות' : 'משתמשים שזמינים לעבודה'}
          value={teamLoading ? '...' : activeTeamMembers.length || loadedTeamMembers.length}
          tone="primary"
        />
        <OpsStoreMiniCard
          icon={ClipboardList}
          title="עם עומס פעיל"
          subtitle={teamError ? 'לא ניתן לקרוא עומסים' : 'עובדים שמוקצות להם הזמנות'}
          value={teamLoading ? '...' : membersWithLoad.length}
          tone="warning"
        />
        <OpsStoreMiniCard
          icon={UserCog}
          title="משימות צוות"
          subtitle={`מנהלים במערכת: ${adminCount}`}
          value={teamLoading ? '...' : teamAssignments}
          tone="neutral"
        />
        <OpsStoreMiniCard
          icon={ShieldCheck}
          title="ניהול עובדים"
          subtitle="הרשאות, משתמשים וטוקנים"
          tone="success"
          href="/settings/users"
        />
      </div>
    );
  };

  const renderInventoryPanel = () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <OpsStoreMiniCard
        icon={Boxes}
        title="פריטים פעילים"
        subtitle={productsLoading ? 'טוען קטלוג' : 'מוצרים זמינים במערכת'}
        value={productsLoading ? '...' : activeProducts.length}
        tone="primary"
      />
      <OpsStoreMiniCard
        icon={PackageSearch}
        title="מלאי נמוך"
        subtitle={
          productsError
            ? 'לא ניתן לקרוא כרגע את נתוני המלאי'
            : lowStockSummary || 'אין פריטים בולטים'
        }
        value={productsLoading ? '...' : lowStockProducts.length}
        tone="warning"
      />
      <OpsStoreMiniCard
        icon={ClipboardList}
        title="רכש ממתין"
        subtitle={
          outOfStockProducts.length ? `${outOfStockProducts.length} אזלו לחלוטין` : 'ללא חוסר קריטי'
        }
        value={procurementCount}
        tone="neutral"
      />
      <OpsStoreMiniCard
        icon={Boxes}
        title="ניהול מלאי"
        subtitle="פתח את הקטלוג והמלאי"
        tone="success"
        href="/products"
      />
    </div>
  );

  const renderCalendarPanel = () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <OpsStoreMiniCard
        icon={CalendarDays}
        title="לתיאום"
        subtitle="הזמנות שמחכות לקביעת חלון"
        value={getCountByStatuses(statusSummary, [
          'INSTALL_SCHEDULING',
          'AWAITING_INSTALL',
          'SCHEDULED',
        ])}
        tone="primary"
      />
      <OpsStoreMiniCard
        icon={Truck}
        title="בדרך / בביצוע"
        subtitle="משימות שכבר יצאו ללקוח"
        value={getCountByStatuses(statusSummary, ['IN_TRANSIT', 'INSTALLATION'])}
        tone="warning"
      />
      <OpsStoreMiniCard
        icon={Clock3}
        title={nextScheduledOrder ? `#${nextScheduledOrder.number}` : 'פוקוס קרוב'}
        subtitle={
          nextScheduledOrder ? (
            <div className="space-y-1">
              <div>
                {nextScheduledOrder.customerName ||
                  nextScheduledOrder.customer?.name ||
                  DISPLAY_TEXT.unknownCustomer}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge
                  status={normalizeOrderStatus(nextScheduledOrder.status)}
                  size="sm"
                  className="!px-2 !py-0.5"
                />
                <span>
                  {formatDateTime(
                    nextScheduledOrder.scheduledAt ?? nextScheduledOrder.updatedAt,
                    locale
                  )}
                </span>
              </div>
            </div>
          ) : scheduleOrdersLoading ? (
            'טוען משימות'
          ) : (
            'פתח את היומן לתיאום הבא'
          )
        }
        value={nextScheduledOrder ? nextScheduledOrder.number : '...'}
        tone="neutral"
        href={nextScheduledOrder ? `/orders/${nextScheduledOrder.id}` : '/orders/calendar'}
      />
      <OpsStoreMiniCard
        icon={CalendarDays}
        title="יומן מלא"
        subtitle="תכנון שבועי של משימות ומסירות"
        tone="success"
        href="/orders/calendar"
      />
    </div>
  );

  const renderSettingsPanel = () => <StoreSettingsWorkspace embedded />;

  let activePanel: ReactNode;
  switch (activeTab) {
    case 'employees':
      activePanel = renderEmployeesPanel();
      break;
    case 'inventory':
      activePanel = renderInventoryPanel();
      break;
    case 'calendar':
      activePanel = renderCalendarPanel();
      break;
    case 'settings':
      activePanel = renderSettingsPanel();
      break;
    case 'orders':
    default:
      activePanel = renderOrdersPanel();
      break;
  }

  return (
    <div className="min-h-full space-y-3 pb-28" dir={direction}>
      <OpsCompactHeader
        title="ניהול חנות"
        subtitle={
          <>
            <span>{todayLabel}</span>
            <span className="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-black text-primary-500">
              ממשק בסיסי
            </span>
            {user?.name ? <span>{user.name}</span> : null}
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <OpsStoreSignal
            icon={ShoppingCart}
            label="פתוחות"
            value={openOrdersCount}
            tone="primary"
          />
          <OpsStoreSignal icon={Truck} label="בזרימה" value={deliveryFlowCount} tone="warning" />
          <OpsStoreSignal
            icon={ClipboardList}
            label="הושלמו"
            value={completedCount}
            tone="success"
          />
        </div>
      </OpsCompactHeader>

      <OpsBoardSurface title={activeTabLabel} countLabel={activeCountLabel}>
        {activePanel}
      </OpsBoardSurface>

      <OpsDisclosurePanel
        title="כלים נוספים"
        open={showSecondaryLinks}
        onToggle={() => setShowSecondaryLinks((open) => !open)}
        buttonLabel="פתח"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {isAdmin ? (
            <OpsStoreMiniCard
              icon={ShieldCheck}
              title="מרכז ניהול (אדמין)"
              subtitle="תבניות, משתמשים, אינטגרציות, גיבוי ועוד"
              tone="neutral"
              href="/settings"
            />
          ) : null}
          <OpsStoreMiniCard
            icon={Truck}
            title="מרכז משלוחים"
            subtitle="תצוגה ממוקדת למסירות"
            tone="neutral"
            href="/deliveries"
          />
          <OpsStoreMiniCard
            icon={BarChart3}
            title="פיננסים"
            subtitle="תמונת מצב כספית"
            tone="neutral"
            href="/dashboard"
          />
          <OpsStoreMiniCard
            icon={LayoutDashboard}
            title="מפת הזמנות"
            subtitle="מעקב מרחבי ומשימות"
            tone="neutral"
            href="/orders/map"
          />
          <OpsStoreMiniCard
            icon={Boxes}
            title="מוצרים"
            subtitle="קטלוג מלא ותחזוקת SKU"
            tone="neutral"
            href="/products"
          />
        </div>
      </OpsDisclosurePanel>

      <OpsStoreFloatingNav
        items={STORE_TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          active: activeTab === tab.id,
          onClick: () => {
            startTransition(() => {
              setActiveTab(tab.id);
            });
          },
        }))}
      />
    </div>
  );
}
