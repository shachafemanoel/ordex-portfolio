import { executeGuards, getGuardErrorMessage } from '@/lib/status-guards';
import { OrderStatus } from '@prisma/client';

export function isOrderIncomplete(order: OrderForValidation): boolean {
  if (!order) return false;

  // An order is considered incomplete if it's a draft from WooCommerce and is missing key information.
  if (order.status === 'DRAFT' && order.wooOrderId) {
    if (!order.hasBilling || !order.hasShipping || !order.hasLineItems || !order.hasTotals) {
      return true;
    }
  }

  // Also, a draft order without a customer is incomplete.
  if (order.status === 'DRAFT' && !order.customerId) {
    return true;
  }

  return false;
}

export function validateStatusTransitionPrerequisites(
  order: any,
  newStatus: OrderStatus,
  options?: any
): { isValid: boolean; errors: string[]; warnings?: string[] } {
  const result = executeGuards(order, newStatus, { additionalData: options });

  return {
    isValid: result.allPassed,
    errors: result.blockingFailures.map(f => f.message),
    warnings: result.warnings.map(w => w.message)
  };
}

export function getMissingFieldsMessage(validationResult: any): string {
  if (validationResult && Array.isArray(validationResult.errors)) {
    return validationResult.errors.join('\n');
  }
  return 'Missing fields';
}

export interface OrderForValidation {
  id?: string;
  status?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  addressLine?: string | null;
  city?: string | null;
  scheduledAt?: Date | string | null;
  installAt?: Date | string | null;
  hasBilling?: boolean;
  hasShipping?: boolean;
  hasLineItems?: boolean;
  hasTotals?: boolean;
  customerId?: string;
  wooOrderId?: string | null;
  shippingAddress?: {
    city?: string | null;
    street?: string | null;
    number?: string | null;
  } | null;
  billingAddress?: {
    city?: string | null;
    street?: string | null;
    number?: string | null;
  } | null;
  items?: Array<{
    id: string;
    quantity?: number;
    qty?: number;
    received?: boolean;
    allocationStatus?: string | null;
    name?: string;
    product?: { id: string; stock?: number } | null;
    productId?: string;
  }> | null;
  installerName?: string | null;
  installerNotes?: string | null;
}
