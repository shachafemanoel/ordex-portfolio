import { OrderStatus, PaymentStatus } from '@prisma/client';
import { isActionAllowed } from '@/shared/lib/status/status-config';

export type ActionContext = {
  status?: OrderStatus | PaymentStatus | string;
  role?: string; // Future RBAC
  // specific entity fields if needed
};

/**
 * Check if an action is permitted in the current context.
 * Currently primarily checks status-based allowedActions.
 */
export function checkActionPermission(actionId: string, context: ActionContext): boolean {
  // If no status provided, assume allowed or fallback to role (for global actions like "Create New")
  if (!context.status) {
    // Global actions might not depend on status.
    // For now, if no status, return true if commonly available?
    // Or stricter: if it's a status-transition action, it requires status.

    // Simple MVP: If no status, allow. Future: check global permissions.
    return true;
  }

  // Check status config
  // We need to cast string status to known types if possible, or isActionAllowed handles strings?
  // isActionAllowed expects OrderStatus | PaymentStatus.
  // We assume context.status matches one of them.

  return isActionAllowed(context.status as OrderStatus | PaymentStatus, actionId);
}
