/**
 * Purchase Orders Domain Type Header
 *
 * This file serves as the central type definition hub for purchase orders domain.
 * All purchase order-related types should be imported from this file.
 */

// Re-export all purchase order types
export type { PurchaseOrderDTO, PurchaseOrderItemDTO } from '@/domain/purchase-orders/normalizePurchaseOrder';

// Re-export normalization utilities
export {
  normalizePurchaseOrder,
  normalizePurchaseOrderItem,
  normalizePurchaseOrderItems,
  normalizePurchaseOrders,
} from './normalizePurchaseOrder';
