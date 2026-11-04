import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileEdit,
  History,
  ListTodo,
  Package2,
  PackageOpen,
  PackageSearch,
  PhoneForwarded,
  PlusCircle,
  Send,
  ShieldCheck,
  ShoppingCart,
  Timer,
  Truck,
  type LucideIcon,
  Wrench,
  XCircle,
  XOctagon,
} from 'lucide-react';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { tPayment, tPurchaseOrder, tTask } from '@/lib/i18n';
import type { EntityTone } from './EntityPrimitives';

// Temporary local type definition to avoid path issues
type OrderTaskColor = 'ORANGE' | 'BLUE' | 'GRAY' | 'GREEN' | 'RED' | 'PURPLE' | 'PINK' | 'YELLOW';

const WARNING_ORDER_STATUSES = new Set([
  'PENDING_APPROVAL',
  'AWAITING_STOCK',
  'PARTIALLY_SUPPLIED',
  'AWAITING_INSTALL',
  'ON_HOLD',
  'CANCELLED',
  'REFUNDED',
]);

const INFO_ORDER_STATUSES = new Set([
  'PROCESSING',
  'CALL_BACK',
  'CONFIRMED',
  'PO_CREATED',
  'INSTALL_SCHEDULING',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
]);

const SUCCESS_ORDER_STATUSES = new Set([
  'READY',
  'READY_FOR_INSTALL',
  'COMPLETED',
  'INSTALLED',
  'SUPPLIED',
  'INVOICED',
]);

export const STATUS_ICONS: Record<string, LucideIcon> = {
  // Order Statuses
  DRAFT: FileEdit,
  TO_DO: ListTodo,
  CALL_BACK: PhoneForwarded,
  PO_CREATED: ShoppingCart,
  AWAITING_STOCK: PackageSearch,
  PARTIALLY_SUPPLIED: Package2,
  READY_FOR_INSTALL: Wrench,
  SCHEDULED: CalendarClock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  PROCESSING: Clock,
  IN_TRANSIT: Truck,
  INSTALLATION: Building2,
  RECEIVED: PlusCircle,
  PENDING_APPROVAL: ShieldCheck,
  CONFIRMED: CheckCircle,
  INSTALL_SCHEDULING: CalendarClock,
  AWAITING_INSTALL: Timer,
  INSTALLED: CheckCircle2,
  SUPPLIED: PackageOpen,
  INVOICED: FileEdit,
  CLOSED: XOctagon,
  ON_HOLD: AlertCircle,
  REFUNDED: History,

  // Purchase Order
  SENT: Send,
  PARTIALLY_RECEIVED: Package2,

  // Payment
  PENDING: Timer,
  AUTHORIZED: ShieldCheck,
  PAID: CreditCard,
  PARTIAL: Banknote,
  FAILED: XCircle,
};

/**
 * Gets the background dot class for a specific tone.
 * Used for the status indicator dot.
 */
export function getEntityToneDotClass(tone: EntityTone): string {
  switch (tone) {
    case 'info':
      return 'bg-[var(--tone-info-strong)]';
    case 'success':
      return 'bg-[var(--tone-success-strong)]';
    case 'warning':
      return 'bg-[var(--tone-warning-strong)]';
    case 'accent':
      return 'bg-[var(--tone-accent-strong)]';
    case 'neutral':
    default:
      return 'bg-[var(--text-tertiary)]';
  }
}

export function mapTaskColorToEntityTone(color: OrderTaskColor): EntityTone {
  switch (color) {
    case 'ORANGE':
      return 'warning';
    case 'BLUE':
      return 'info';
    case 'GRAY':
    default:
      return 'neutral';
  }
}

export function getOrderStatusDisplay(status: string | null | undefined): {
  label: string;
  tone: EntityTone;
} {
  const normalized = normalizeOrderStatus(status);
  const normalizedKey = String(normalized);

  if (SUCCESS_ORDER_STATUSES.has(normalizedKey)) {
    return { label: getStatusLabel(normalized), tone: 'success' };
  }

  if (WARNING_ORDER_STATUSES.has(normalizedKey)) {
    return { label: getStatusLabel(normalized), tone: 'warning' };
  }

  if (INFO_ORDER_STATUSES.has(normalizedKey)) {
    return { label: getStatusLabel(normalized), tone: 'info' };
  }

  return { label: getStatusLabel(normalized), tone: 'neutral' };
}

export type EntityStatusType = 'order' | 'purchase' | 'installation' | 'payment';

export function getEntityStatusDisplay(
  status: string | null | undefined,
  type: EntityStatusType = 'order'
): {
  label: string;
  tone: EntityTone;
} {
  const statusKey = String(status ?? '').toUpperCase();

  if (type === 'order') {
    return getOrderStatusDisplay(statusKey);
  }

  if (type === 'purchase') {
    if (statusKey === 'RECEIVED' || statusKey === 'COMPLETE') {
      return { label: tPurchaseOrder('status', 'RECEIVED'), tone: 'success' };
    }
    if (statusKey === 'SENT' || statusKey === 'PARTIALLY_RECEIVED' || statusKey === 'PARTIAL') {
      return {
        label:
          statusKey === 'SENT'
            ? tPurchaseOrder('status', 'SENT')
            : tPurchaseOrder('status', 'PARTIALLY_RECEIVED'),
        tone: statusKey === 'SENT' ? 'info' : 'warning',
      };
    }
    if (statusKey === 'CANCELLED') {
      return { label: tPurchaseOrder('status', 'CANCELLED'), tone: 'warning' };
    }
    return { label: tPurchaseOrder('status', 'DRAFT'), tone: 'neutral' };
  }

  if (type === 'installation') {
    if (statusKey === 'COMPLETED') {
      return { label: tTask('type', 'INSTALL_COMPLETED', { fallback: 'הושלם' }), tone: 'success' };
    }
    if (statusKey === 'SCHEDULED' || statusKey === 'IN_PROGRESS') {
      return {
        label:
          statusKey === 'IN_PROGRESS'
            ? 'בביצוע'
            : tTask('type', 'INSTALL_SCHEDULED', { fallback: 'מתוזמן' }),
        tone: 'info',
      };
    }
    if (statusKey === 'CANCELLED') {
      return { label: tTask('type', 'INSTALL_CANCELLED', { fallback: 'בוטל' }), tone: 'warning' };
    }
    return { label: tTask('type', 'INSTALL_PENDING', { fallback: 'ממתין' }), tone: 'neutral' };
  }

  if (statusKey === 'PAID') {
    return { label: tPayment('status', 'PAID'), tone: 'success' };
  }
  if (statusKey === 'AUTHORIZED' || statusKey === 'PARTIAL') {
    return {
      label: statusKey === 'AUTHORIZED' ? tPayment('status', 'AUTHORIZED') : tPayment('status', 'PARTIAL'),
      tone: 'info',
    };
  }
  if (statusKey === 'FAILED' || statusKey === 'PENDING') {
    return {
      label: statusKey === 'FAILED' ? tPayment('status', 'FAILED') : tPayment('status', 'PENDING'),
      tone: 'warning',
    };
  }
  if (statusKey === 'REFUNDED') {
    return { label: tPayment('status', 'REFUNDED'), tone: 'neutral' };
  }

  return { label: String(status ?? ''), tone: 'neutral' };
}

export function getDeliveryOperationalDisplay({
  status,
  scheduledAt,
}: {
  status: string;
  scheduledAt?: string | Date | null;
}): {
  label: string;
  tone: EntityTone;
} {
  const hasSchedule = Boolean(scheduledAt);
  const dispatchable = new Set([
    'AWAITING_INSTALL',
    'SCHEDULED',
    'READY_FOR_INSTALL',
    'INSTALL_SCHEDULING',
    'READY',
  ]);
  const inExecution = new Set(['IN_TRANSIT', 'INSTALLATION']);

  if (inExecution.has(status)) {
    return { label: 'בביצוע', tone: 'success' };
  }

  if (dispatchable.has(status) && !hasSchedule) {
    return { label: 'דורש תיאום', tone: 'warning' };
  }

  if (dispatchable.has(status) && hasSchedule) {
    return { label: 'מוכן ליציאה', tone: 'info' };
  }

  return { label: 'פרטי מסירה', tone: 'neutral' };
}
