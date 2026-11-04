/**
 * @deprecated This file is deprecated. Use @/lib/orderStatus instead.
 * All status configuration has been unified in lib/orderStatus.ts
 *
 * קובץ זה מיושן. יש להשתמש ב-@/lib/orderStatus במקום.
 * כל תצורת הסטטוסים אוחדה בקובץ lib/orderStatus.ts
 */

// Re-export from the unified config file
export {
  ORDER_STATUS_CONFIG,
  type OrderStatusConfig,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_HEX_COLORS,
  getStatusLabel,
  getStatusColor,
  getStatusHexColor,
  getStatusGroup,
  getStatusesByGroup,
} from '@/lib/orderStatus';
