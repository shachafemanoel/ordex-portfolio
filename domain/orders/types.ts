/**
 * Orders Domain Type Header
 *
 * This file serves as the central type definition hub for the orders domain.
 * All order-related types should be imported from this file to ensure consistency
 * and prevent duplicate type definitions.
 */

// Core OrderStatus from Prisma - single source of truth
export type { OrderStatus } from '@prisma/client';

// Re-export all order-related types from orderDTO
// Using type-only exports to prevent circular dependencies
export type {
  AddressSummary,
  OrderCalendarEventDTO,
  OrderCreateInput,
  OrderCustomerSummary,
  OrderDTO,
  OrderItemDTO,
  OrderPaymentDTO,
  OrderPurchaseOrderSummary,
  OrderShipmentDTO,
  OrderUpdateInput,
  ProductSummary,
  SupplierSummary,
} from './orderDTO';

// Re-export workflow types
export type {
  OrderWorkflowContext,
  OrderWorkflowSnapshot,
  OrderWorkflowState,
  WorkflowAction,
  WorkflowRequirement,
  WorkflowTransitionState,
} from './orderWorkflow';

// Re-export normalization utilities (type-only)
export { normalizeOrder } from '@/domain/orders/normalizeOrder';
