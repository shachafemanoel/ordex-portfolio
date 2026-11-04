import { OrderStatus } from '@prisma/client';

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

export interface ActionPayload {
  reason?: DeferReason | string;
  until?: string; // ISO datetime
  items?: Array<{ productId: string; qty: number }>;
  estimatedDays?: number;
  estimatedDeliveryAt?: string; // ISO datetime
}

export interface ExecuteActionResult {
  orderId: string;
  status: OrderStatus;
  nextActionType: string | null;
  nextActionAt: string | null;
  isUrgent: boolean;
}
