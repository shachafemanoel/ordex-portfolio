import { Order, OrderItem } from '@prisma/client';
import { isFuture } from 'date-fns';

export type OpsLane = 'NEEDS_ACTION' | 'WAITING' | 'SCHEDULED';

export interface OpsChecklistItem {
  key: string;
  label: string;
  isMet: boolean;
  required: boolean;
  action?: 'OPEN_MODAL' | 'PATCH' | 'NAVIGATE';
  actionPayload?: any;
}

export interface OpsItemState {
  id: string;
  sku: string;
  name: string;
  qty: number;
  receivedQty: number;
  supplierSentAt: Date | null;
  expectedSupplyAt: Date | null;
  status: 'PENDING' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'INSTALLED';
}

export interface OrderOpsState {
  lane: OpsLane;
  labelKey: string;
  labelHe: string;
  tone: 'default' | 'urgent' | 'success' | 'warning';
  isUrgent: boolean;
  waitingSince: Date;
  progressPct: number;
  checklist: OpsChecklistItem[];
  itemChecks: OpsItemState[];
}

// Helper to determine item status
function computeItemStatus(item: OrderItem): OpsItemState['status'] {
  if (item.receivedQuantity >= item.qty) return 'RECEIVED';
  if (item.receivedQuantity > 0) return 'PARTIALLY_RECEIVED';
  if (item.sentToSupplierAt) return 'ORDERED';
  return 'PENDING';
}

export function computeOrderOpsState(order: Order & { items: OrderItem[] }): OrderOpsState {
  const now = new Date();

  // 1. Compute Item Checks
  const itemChecks: OpsItemState[] = order.items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    qty: item.qty,
    receivedQty: item.receivedQuantity,
    supplierSentAt: item.sentToSupplierAt,
    expectedSupplyAt: item.estimatedSupplyAt,
    status: computeItemStatus(item),
  }));

  // 2. Determine Lane
  let lane: OpsLane = 'NEEDS_ACTION';
  let labelKey = 'PROCESSING';
  let labelHe = 'בטיפול';
  let tone: OrderOpsState['tone'] = 'default';

  const hasScheduledDate = order.scheduledAt && isFuture(new Date(order.scheduledAt));
  const isInstalled = order.status === 'INSTALLED' || order.status === 'COMPLETED';
  const hasItems = itemChecks.length > 0;
  const allItemsReceived = hasItems && itemChecks.every(
    (i) => i.status === 'RECEIVED' || i.status === 'INSTALLED'
  );
  const allItemsOrdered = hasItems && itemChecks.every((i) => i.status !== 'PENDING');
  const allItemsHaveEta = hasItems && itemChecks.every(
    (i) => i.expectedSupplyAt && new Date(i.expectedSupplyAt) >= now
  );
  const hasOverdueSupply = itemChecks.some(
    (i) =>
      i.status !== 'RECEIVED' &&
      i.status !== 'INSTALLED' &&
      i.expectedSupplyAt &&
      new Date(i.expectedSupplyAt) < now
  );
  const isUrgent = Boolean(order.urgent || hasOverdueSupply);

  if (hasScheduledDate || isInstalled) {
    lane = 'SCHEDULED';
    labelKey = 'SCHEDULED';
    labelHe = 'מתוזמן';
    tone = 'success';
  } else if (allItemsReceived) {
    // Items received, waiting for scheduling
    lane = 'NEEDS_ACTION'; // Needs scheduling
    labelKey = 'READY_TO_SCHEDULE';
    labelHe = 'מוכן לתיאום';
    tone = 'warning';
  } else if (allItemsOrdered && allItemsHaveEta) {
    // Waiting for suppliers
    lane = 'WAITING';
    labelKey = 'WAITING_SUPPLIER';
    labelHe = 'ממתין לסחורה';
    tone = 'default';
  } else if (hasOverdueSupply) {
    lane = 'NEEDS_ACTION';
    labelKey = 'SUPPLIER_OVERDUE';
    labelHe = 'איחור באספקה';
    tone = 'urgent';
  } else {
    // Default
    lane = 'NEEDS_ACTION';

    if (order.status === 'RECEIVED') {
      // Prisma enum might be case sensitive per schema
      labelKey = 'NEW_ORDER';
      labelHe = 'הזמנה חדשה';
      tone = 'urgent';
    } else {
      labelKey = 'PROCESSING';
      labelHe = 'בטיפול';
    }
  }

  // Force urgent tone for flagged/overdue orders
  if (isUrgent && tone !== 'success') {
    tone = 'urgent';
  }

  // 3. Build Checklist
  const checklist: OpsChecklistItem[] = [];

  // Generic rules
  // Address
  checklist.push({
    key: 'address_valid',
    label: 'כתובת תקינה (עיר, רחוב, מספר)',
    isMet: !!(order.city && order.addressLine), // Simplified check
    required: true,
    action: 'OPEN_MODAL',
    actionPayload: { tab: 'details' },
  });

  // Items exists
  checklist.push({
    key: 'items_exist',
    label: 'פריטים בהזמנה',
    isMet: order.items.length > 0,
    required: true,
    action: 'OPEN_MODAL',
    actionPayload: { tab: 'items' },
  });

  // Supplier checks
  if (order.items.length > 0) {
    const sentCount = itemChecks.filter((i) => i.status !== 'PENDING').length;
    checklist.push({
      key: 'items_ordered',
      label: `הזמנת רכש (${sentCount}/${order.items.length})`,
      isMet: sentCount === order.items.length,
      required: true,
      action: 'OPEN_MODAL',
      actionPayload: { tab: 'items' },
    });
  }

  // Arrival checks
  if (allItemsOrdered) {
    const receivedCount = itemChecks.filter((i) => i.status === 'RECEIVED').length;
    checklist.push({
      key: 'items_received',
      label: `קליטת סחורה (${receivedCount}/${order.items.length})`,
      isMet: receivedCount === order.items.length,
      required: true,
      action: 'OPEN_MODAL',
      actionPayload: { tab: 'items' },
    });
  }

  // Scheduling
  if (allItemsReceived) {
    checklist.push({
      key: 'scheduled',
      label: 'תיאום אספקה/התקנה',
      isMet: !!order.scheduledAt,
      required: true,
      action: 'OPEN_MODAL',
      actionPayload: { tab: 'summary' }, // Or specific schedule modal
    });
  }

  // 4. Progress
  const requiredItems = checklist.filter((i) => i.required);
  const completedRequired = requiredItems.filter((i) => i.isMet).length;
  const progressPct =
    requiredItems.length > 0 ? Math.round((completedRequired / requiredItems.length) * 100) : 0;

  return {
    lane,
    labelKey,
    labelHe,
    tone,
    isUrgent,
    waitingSince: order.statusUpdatedAt
      ? new Date(order.statusUpdatedAt)
      : order.updatedAt
        ? new Date(order.updatedAt)
        : new Date(),
    progressPct,
    checklist,
    itemChecks,
  };
}
