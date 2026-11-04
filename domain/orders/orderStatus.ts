/**
 * Order status domain utilities
 * Re-exports from lib/orderStatus for backward compatibility
 */
import {
  normalizeOrderStatus as normalize,
  ORDER_STATUS,
  getStatusesAsOptions,
  type OrderStatus,
} from '@/lib/orderStatus';

// Re-export the normalize function
export const normalizeOrderStatus = normalize;

// Re-export labels (ORDER_STATUS_LABELS is an alias for ORDER_STATUS)
export const ORDER_STATUS_LABELS = ORDER_STATUS;

// Re-export options (ORDER_STATUS_OPTIONS is getStatusesAsOptions())
export const ORDER_STATUS_OPTIONS = getStatusesAsOptions();

// Re-export the type
export type { OrderStatus };
