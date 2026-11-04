import { Order, OrderItem, OrderStatus, TaskLabel, DeferBucket, CalendarEvent, Payment, PurchaseOrder, Address } from '@prisma/client';

export type OrderDomain = Order & {
  items: OrderItem[];
  shippingAddress: Address | null;
  calendarEvents: CalendarEvent[];
  relatedPurchaseOrders?: PurchaseOrder[];
  payments?: Payment[];
};

export interface OrderState {
  status: OrderStatus;
  taskLabel: TaskLabel | null;
  opsLane: string | null;
  opsCurrentTask: string | null;
  opsSnoozeUntil: Date | null;
  opsSnoozeReason: string | null;
  scheduledAt: Date | null;
  urgent: boolean;
  lastActionAt: Date | null;
  checklistState: Record<string, any> | null;
}

export interface ReconcileResult {
  lane: string;
  laneLabel: string;
  color: string;
  currentTask: any; // DrillTask
  nextTask: any | null;
  progressPct: number;
  isSnoozed: boolean;
  snoozeUntil: Date | null;
  snoozeReason: string | null;
  checklistOverrides: Record<string, boolean>;
  requirements: any[];
  deferBucket: DeferBucket | null;
  isBlocked: boolean;
  blockReasons: string[];
}
