/**
 * DTOs for the Ops endpoints.
 * GET  /api/v1/ops/queues
 * POST /api/v1/ops/orders/[id]/action
 */

export type OpsScope = 'orders' | 'shipments';
export type OpsTab = 'new' | 'future' | 'active';

/** Minimal order summary shown inside a queue */
export interface OpsQueueItem {
  id: string;
  number: string;
  customerName: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  city?: string | null;
  addressLine?: string | null;
  /** Optional route distance when known (e.g. from planning); queue API may omit */
  distanceKm?: number | null;
  nextActionAt: string | null; // ISO timestamp
  isUrgent: boolean;
  summary: string;
  status?: string | null;
  derivedTask: DerivedTaskInfo;
  /** Short textual summary of order items, e.g. "ספה • מיטה +2" */
  itemsSummary: string | null;
  itemsCount: number;
  itemLabels?: string[];
}

/** A single named queue with top-1 + count + optional rest */
export interface OpsQueue {
  key: string;
  title: string;
  top: OpsQueueItem | null;
  count: number;
  rest: OpsQueueItem[];
}

/** Full response envelope */
export interface OpsQueuesResponse {
  scope: OpsScope;
  tab: OpsTab;
  dailyWindowHours: number;
  queues: OpsQueue[];
}

// ---------------------------------------------------------------------------
// Action endpoint DTOs
// ---------------------------------------------------------------------------

export type OrderTaskColor = 'GRAY' | 'BLUE' | 'ORANGE';

export interface TimelineStep {
  key: string;
  titleHe: string;
  state: 'done' | 'active' | 'blocked' | 'upcoming';
}

export interface DerivedTaskInfo {
  taskColor: OrderTaskColor;
  taskTitleHe: string;
  statusLabelHe: string;
  primaryAction: {
    key: string;
    labelHe: string;
  };
  /** @deprecated use primaryAction.labelHe */
  primaryActionHe: string;
  secondaryActionHe?: string;
  progressPct: number;
  timelineSteps: TimelineStep[];
  isActionableNow: boolean;
}

export type OpsActionType =
  | 'START'
  | 'COMPLETE'
  | 'DEFER'
  | 'SPLIT'
  | 'CANCEL'
  | 'MARK_PICKED'
  | 'MARK_DELIVERED'
  | 'SET_CUSTOMER_WAIT';

export type DeferReason =
  | 'WAITING_SUPPLIER'
  | 'WAITING_CUSTOMER'
  | 'MISSING_DETAILS'
  | 'SCHEDULING';

export interface OpsActionRequest {
  actionType: OpsActionType;
  payload?: {
    reason?: DeferReason | string;
    until?: string;
    items?: Array<{ productId: string; qty: number }>;
    estimatedDays?: number;
    estimatedDeliveryAt?: string;
  };
}

export interface OpsActionResponse {
  orderId: string;
  status: string;
  nextActionType: string | null;
  nextActionAt: string | null;
  isUrgent: boolean;
}
