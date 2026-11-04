import { mapLegacyStatusToOrderStatus } from '@/domain/status/legacyStatusMap';
import { OrderStatus } from '@prisma/client';

/**
 * מבנה מרכזי לכל תצורת הסטטוסים במערכת
 * כולל: תווית בעברית, צבעים (CSS classes ו-hex), וקבוצה לוגית
 */
export interface OrderStatusConfig {
  label: string;
  color: string; // Tailwind CSS classes
  hexColor: string; // Hex color for charts
  group: 'open' | 'active' | 'completed' | 'cancelled';
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  // --- Core statuses ---
  RECEIVED: {
    label: 'התקבל',
    color: 'bg-status-gray-bg text-status-gray-text',
    hexColor: '#94a3b8',
    group: 'open',
  },
  PROCESSING: {
    label: 'בטיפול',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  READY: {
    label: 'מוכן',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#22c55e',
    group: 'active',
  },
  IN_TRANSIT: {
    label: 'בדרך',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  INSTALLATION: {
    label: 'בהתקנה',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  COMPLETED: {
    label: 'הושלם',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#22c55e',
    group: 'completed',
  },
  // --- Legacy statuses (mapped to core equivalents) ---
  DRAFT: {
    label: 'טיוטה',
    color: 'bg-status-gray-bg text-status-gray-text',
    hexColor: '#94a3b8',
    group: 'open',
  },
  TO_DO: {
    label: 'לטיפול',
    color: 'bg-status-gray-bg text-status-gray-text',
    hexColor: '#94a3b8',
    group: 'open',
  },
  CALL_BACK: {
    label: 'חזרה ללקוח',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  PENDING_APPROVAL: {
    label: 'ממתין לאישור',
    color: 'bg-status-amber-bg text-status-amber-text',
    hexColor: '#f97316',
    group: 'open',
  },
  CONFIRMED: {
    label: 'אושר',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'open',
  },
  PO_CREATED: {
    label: 'נוצרה הזמנת רכש',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  AWAITING_STOCK: {
    label: 'ממתין למלאי',
    color: 'bg-status-amber-bg text-status-amber-text',
    hexColor: '#f97316',
    group: 'active',
  },
  PARTIALLY_SUPPLIED: {
    label: 'סופק חלקית',
    color: 'bg-status-amber-bg text-status-amber-text',
    hexColor: '#f97316',
    group: 'active',
  },
  READY_FOR_INSTALL: {
    label: 'מוכן להתקנה',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#10b981',
    group: 'active',
  },
  INSTALL_SCHEDULING: {
    label: 'תיאום התקנה',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  AWAITING_INSTALL: {
    label: 'ממתין להתקנה',
    color: 'bg-status-amber-bg text-status-amber-text',
    hexColor: '#f97316',
    group: 'active',
  },
  SCHEDULED: {
    label: 'מתוזמן',
    color: 'bg-status-blue-bg text-status-blue-text',
    hexColor: '#3b82f6',
    group: 'active',
  },
  INSTALLED: {
    label: 'הותקן',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#10b981',
    group: 'completed',
  },
  SUPPLIED: {
    label: 'סופק',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#10b981',
    group: 'completed',
  },
  INVOICED: {
    label: 'חשבונית',
    color: 'bg-status-green-bg text-status-green-text',
    hexColor: '#22c55e',
    group: 'completed',
  },
  CLOSED: {
    label: 'נסגר',
    color: 'bg-status-gray-bg text-status-gray-text',
    hexColor: '#94a3b8',
    group: 'completed',
  },
  ON_HOLD: {
    label: 'מושהה',
    color: 'bg-status-amber-bg text-status-amber-text',
    hexColor: '#f97316',
    group: 'active',
  },
  CANCELLED: {
    label: 'בוטל',
    color: 'bg-status-red-bg text-status-red-text',
    hexColor: '#ef4444',
    group: 'cancelled',
  },
  REFUNDED: {
    label: 'הוחזר',
    color: 'bg-status-red-bg text-status-red-text',
    hexColor: '#ef4444',
    group: 'cancelled',
  },
};

// Canonical Flow
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'RECEIVED',
  'PROCESSING',
  'READY',
  'IN_TRANSIT',
  'INSTALLATION',
  'COMPLETED',
  'CANCELLED',
];

// Transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Core flow
  // MVP flow: one step forward at a time, one step back to correct a mistake.
  // COMPLETED is reachable only from IN_TRANSIT or INSTALLATION.
  RECEIVED: ['PROCESSING', 'ON_HOLD', 'CANCELLED'],
  PROCESSING: ['READY', 'RECEIVED', 'ON_HOLD', 'CANCELLED'],
  READY: ['IN_TRANSIT', 'INSTALLATION', 'PROCESSING', 'ON_HOLD', 'CANCELLED'],
  IN_TRANSIT: ['INSTALLATION', 'COMPLETED', 'READY', 'ON_HOLD', 'CANCELLED'],
  INSTALLATION: ['COMPLETED', 'READY', 'ON_HOLD', 'CANCELLED'],
  COMPLETED: [],
  // Resuming returns only to the status held before; OrdersService enforces which one.
  ON_HOLD: ['RECEIVED', 'PROCESSING', 'READY', 'IN_TRANSIT', 'INSTALLATION', 'CANCELLED'],
  CANCELLED: [],
  REFUNDED: [],
  // Legacy statuses all transition to their canonical equivalent
  DRAFT: ['RECEIVED', 'CANCELLED'],
  TO_DO: ['RECEIVED', 'PROCESSING', 'CANCELLED'],
  CALL_BACK: ['PROCESSING', 'RECEIVED', 'CANCELLED'],
  PENDING_APPROVAL: ['RECEIVED', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['RECEIVED', 'PROCESSING', 'CANCELLED'],
  PO_CREATED: ['PROCESSING', 'AWAITING_STOCK', 'CANCELLED'],
  AWAITING_STOCK: ['PROCESSING', 'PARTIALLY_SUPPLIED', 'CANCELLED'],
  PARTIALLY_SUPPLIED: ['PROCESSING', 'READY', 'CANCELLED'],
  READY_FOR_INSTALL: ['READY', 'INSTALLATION', 'SCHEDULED', 'CANCELLED'],
  INSTALL_SCHEDULING: ['READY', 'SCHEDULED', 'CANCELLED'],
  AWAITING_INSTALL: ['INSTALLATION', 'COMPLETED', 'CANCELLED'],
  SCHEDULED: ['IN_TRANSIT', 'INSTALLATION', 'CANCELLED'],
  INSTALLED: ['COMPLETED'],
  SUPPLIED: ['COMPLETED'],
  INVOICED: ['COMPLETED'],
  CLOSED: ['COMPLETED'],
};

/**
 * Statuses of the MVP order flow. Orders in these statuses change status only through
 * an explicit, validated transition; background recalculation never moves them.
 */
export const MVP_FLOW_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  ...ORDER_STATUS_FLOW,
  'ON_HOLD',
]);

/** Same default as POST /api/orders/:id/advance-status without targetStatus (first transition ≠ CANCELLED). */
export function getDefaultAdvanceTarget(status: OrderStatus): OrderStatus | undefined {
  const transitions = ORDER_STATUS_TRANSITIONS[status] ?? [];
  return transitions.find((s) => s !== OrderStatus.CANCELLED);
}

// --- Helpers ---

export function getStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status]?.label || status;
}

export function getStatusColor(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status]?.color || 'bg-gray-50 text-gray-700';
}

export function getStatusHexColor(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status]?.hexColor || '#94a3b8';
}

export function getStatusGroup(status: OrderStatus): 'open' | 'active' | 'completed' | 'cancelled' {
  return ORDER_STATUS_CONFIG[status]?.group || 'open';
}

export function getStatusMeta(status: OrderStatus): OrderStatusConfig {
  return ORDER_STATUS_CONFIG[status];
}

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  OrderStatus.COMPLETED,
  OrderStatus.SUPPLIED,
  OrderStatus.INSTALLED,
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]);

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function normalizeOrderStatus(status: string | OrderStatus | null | undefined): OrderStatus {
  if (!status) return OrderStatus.DRAFT;

  if (typeof status !== 'string') {
    return status;
  }

  try {
    return mapLegacyStatusToOrderStatus(status);
  } catch {
    const externalAliases: Record<string, OrderStatus> = {
      NEW: OrderStatus.TO_DO,
      CALLBACK_CUSTOMER: OrderStatus.CALL_BACK,
      WAITING_GOODS: OrderStatus.AWAITING_STOCK,
      WAITING_SUPPLIER: OrderStatus.AWAITING_STOCK,
      PARTIAL: OrderStatus.PARTIALLY_SUPPLIED,
      PURCHASE_ORDER: OrderStatus.PO_CREATED,
      SCHEDULE_INSTALL: OrderStatus.READY_FOR_INSTALL,
      WAITING_INSTALL: OrderStatus.AWAITING_INSTALL,
    };

    return externalAliases[status.toUpperCase().trim()] ?? OrderStatus.DRAFT;
  }
}

export function isPendingStatus(status: OrderStatus): boolean {
  const group = getStatusGroup(status);
  return group === 'open' || group === 'active';
}

export function isCompletedStatus(status: OrderStatus): boolean {
  return getStatusGroup(status) === 'completed';
}

export function getAllStatuses(): OrderStatus[] {
  return ORDER_STATUS_FLOW;
}

export function getSelectableStatuses(): OrderStatus[] {
  return ORDER_STATUS_FLOW;
}

export function getTransitionTargets(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status] || [];
}

export function getStatusesAsOptions() {
  return getAllStatuses().map((s) => ({ value: s, label: getStatusLabel(s) }));
}

export const ORDER_STATUS_OPTIONS = getStatusesAsOptions();

export type { OrderStatus } from '@prisma/client';

export const ORDER_STATUS = Object.fromEntries(ORDER_STATUS_FLOW.map((s) => [s, s])) as Record<
  OrderStatus,
  OrderStatus
>;

// Re-export for compatibility with other files expecting specific exports
export type CanonicalOrderStatus = OrderStatus;
export const CANONICAL_ORDER_FLOW = ORDER_STATUS_FLOW;
export const normalizeToCanonicalStatus = normalizeOrderStatus;
export const getCanonicalStatusLabel = getStatusLabel;
export const getCanonicalStatusColor = getStatusColor;

// Derived maps for backward compatibility
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = Object.fromEntries(
  Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => [k, v.label])
) as Record<OrderStatus, string>;

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = Object.fromEntries(
  Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => [k, v.color])
) as Record<OrderStatus, string>;

export const ORDER_STATUS_HEX_COLORS: Record<OrderStatus, string> = Object.fromEntries(
  Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => [k, v.hexColor])
) as Record<OrderStatus, string>;

export const CANONICAL_STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

export function getStatusesByGroup(
  group: 'open' | 'active' | 'completed' | 'cancelled'
): OrderStatus[] {
  return (Object.entries(ORDER_STATUS_CONFIG) as [OrderStatus, OrderStatusConfig][])
    .filter(([, v]) => v.group === group)
    .map(([k]) => k);
}
