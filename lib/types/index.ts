/**
 * Central type exports for Ordex OMS
 * Re-exports domain types for backward compatibility
 */

// Domain types
export type { OrderDTO, OrderCustomerSummary, OrderItemDTO } from '@/domain/orders';
export type { CustomerDTO } from '@/domain/customers/customerDTO';
export type { ProductDTO } from '@/domain/products/productDTO';
export type { UserDTO } from '@/domain/users/userDTO';

// Prisma enums
export { OrderStatus, OrderPriority, OrderChannel, PaymentStatus, UserRole } from '@prisma/client';

// Alias for backward compatibility
export type { OrderDTO as Order } from '@/domain/orders';
