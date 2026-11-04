import { normalizeOrderStatus } from '@/lib/orderStatus';
import type { OrderStatus } from '@prisma/client';
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Package,
  Phone,
  ShoppingCart,
  Truck,
  Wrench,
} from 'lucide-react';
import type { ElementType } from 'react';

export type QuickActionIntent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface ResolvedOrderQuickAction {
  id: string;
  label: string;
  labelEn: string;
  icon: ElementType;
  intent: QuickActionIntent;
  targetStatus?: OrderStatus;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
  requiresConfirm?: boolean;
}

interface ResolveParams {
  orderId: string;
  rawStatus: string;
}

const ACTIVE_EXECUTION_STATUSES = new Set<OrderStatus>([
  'TO_DO',
  'RECEIVED',
  'CALL_BACK',
  'PROCESSING',
  'CONFIRMED',
  'PO_CREATED',
  'AWAITING_STOCK',
  'PARTIALLY_SUPPLIED',
  'READY_FOR_INSTALL',
  'READY',
  'INSTALL_SCHEDULING',
  'AWAITING_INSTALL',
  'SCHEDULED',
  'IN_TRANSIT',
  'INSTALLATION',
]);

const STATUS_PRIMARY_ACTIONS: Partial<Record<OrderStatus, ResolvedOrderQuickAction[]>> = {
  TO_DO: [
    {
      id: 'start-processing',
      label: 'התחל טיפול',
      labelEn: 'Start Processing',
      icon: ArrowRight,
      intent: 'primary',
      targetStatus: 'PROCESSING',
    },
  ],
  RECEIVED: [
    {
      id: 'start-processing',
      label: 'התחל טיפול',
      labelEn: 'Start Processing',
      icon: ArrowRight,
      intent: 'primary',
      targetStatus: 'PROCESSING',
    },
  ],
  CALL_BACK: [
    {
      id: 'start-processing',
      label: 'בטיפול',
      labelEn: 'In Progress',
      icon: ArrowRight,
      intent: 'primary',
      targetStatus: 'PROCESSING',
    },
    {
      id: 'call-customer',
      label: 'חזרה ללקוח',
      labelEn: 'Call Customer',
      icon: Phone,
      intent: 'warning',
    },
  ],
  PROCESSING: [
    {
      id: 'mark-ready',
      label: 'סמן כמוכן',
      labelEn: 'Mark Ready',
      icon: CheckCircle,
      intent: 'success',
      targetStatus: 'READY',
    },
  ],
  CONFIRMED: [
    {
      id: 'create-po',
      label: 'הזנת פרטי רכש',
      labelEn: 'Add Purchase Details',
      icon: ShoppingCart,
      intent: 'neutral',
      href: '',
      disabled: true,
      disabledReason: 'פתח הזמנה להמשך הטיפול',
    },
  ],
  PO_CREATED: [
    {
      id: 'await-stock',
      label: 'ממתין למלאי',
      labelEn: 'Awaiting Stock',
      icon: Package,
      intent: 'warning',
      targetStatus: 'AWAITING_STOCK',
    },
  ],
  AWAITING_STOCK: [
    {
      id: 'partial-supply',
      label: 'סמן קבלה חלקית',
      labelEn: 'Partial Received',
      icon: Package,
      intent: 'warning',
      targetStatus: 'PARTIALLY_SUPPLIED',
    },
  ],
  PARTIALLY_SUPPLIED: [
    {
      id: 'mark-ready',
      label: 'סמן מוכן',
      labelEn: 'Mark Ready',
      icon: CheckCircle,
      intent: 'success',
      targetStatus: 'READY',
    },
  ],
  READY_FOR_INSTALL: [
    {
      id: 'open-for-scheduling',
      label: 'פתח לתיאום',
      labelEn: 'Open for Scheduling',
      icon: Wrench,
      intent: 'primary',
      href: '',
    },
  ],
  READY: [
    {
      id: 'send-delivery',
      label: 'שגר לאספקה',
      labelEn: 'Send for Delivery',
      icon: Truck,
      intent: 'primary',
      targetStatus: 'IN_TRANSIT',
    },
  ],
  INSTALL_SCHEDULING: [
    {
      id: 'open-install-schedule',
      label: 'פתח לתיאום',
      labelEn: 'Open to Schedule',
      icon: Wrench,
      intent: 'primary',
      href: '',
    },
  ],
  AWAITING_INSTALL: [
    {
      id: 'start-install',
      label: 'התחל התקנה',
      labelEn: 'Start Install',
      icon: Wrench,
      intent: 'primary',
      targetStatus: 'INSTALLATION',
    },
  ],
  SCHEDULED: [
    {
      id: 'in-transit',
      label: 'שגר',
      labelEn: 'Dispatch',
      icon: Truck,
      intent: 'primary',
      targetStatus: 'IN_TRANSIT',
    },
  ],
  IN_TRANSIT: [
    {
      id: 'mark-delivered',
      label: 'סמן נמסר',
      labelEn: 'Mark Delivered',
      icon: CheckCircle,
      intent: 'success',
      targetStatus: 'COMPLETED',
    },
  ],
  INSTALLATION: [
    {
      id: 'mark-complete',
      label: 'סיים התקנה',
      labelEn: 'Complete Install',
      icon: CheckCircle,
      intent: 'success',
      targetStatus: 'COMPLETED',
    },
  ],
};

function buildOpenOrderFallback(orderId: string): ResolvedOrderQuickAction {
  return {
    id: 'open-order',
    label: 'פתח הזמנה',
    labelEn: 'Open Order',
    icon: ExternalLink,
    intent: 'neutral',
    href: `/orders/${orderId}`,
  };
}

export function resolveOrderExecutionQuickActions({ orderId, rawStatus }: ResolveParams) {
  const status = normalizeOrderStatus(rawStatus);
  const resolved = STATUS_PRIMARY_ACTIONS[status] ?? [];

  if (resolved.length === 0) {
    if (!ACTIVE_EXECUTION_STATUSES.has(status)) {
      return [];
    }
    return [buildOpenOrderFallback(orderId)];
  }

  const withSafeLinks = resolved.map((action) => {
    if (!action.href) return action;
    return {
      ...action,
      href: `/orders/${orderId}`,
    };
  });

  return withSafeLinks;
}

export function isActiveExecutionStatus(rawStatus: string): boolean {
  return ACTIVE_EXECUTION_STATUSES.has(normalizeOrderStatus(rawStatus));
}
