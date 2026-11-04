import {
  StatusGuardResult,
  SupplyChainAction,
  SupplyChainContext,
  SupplyChainStage,
} from '@/lib/types/supply-chain';
import { Order, OrderStatus } from '@prisma/client';

export class StatusGuard {
  /**
   * Check if a specific action can be executed on an order
   */
  static canExecuteAction(
    order: Order,
    action: SupplyChainAction,
    context: SupplyChainContext
  ): StatusGuardResult {
    // 1. Check Role Permissions
    if (!this.hasPermission(context.userRole, action)) {
      return { allowed: false, reason: 'Insufficient permissions' };
    }

    // 2. Stage-Specific Validation
    const stage = this.getStageForStatus(order.status);

    switch (stage) {
      case SupplyChainStage.PAYMENT:
        return this.validatePaymentStage(order, action);
      case SupplyChainStage.PROCUREMENT:
        return this.validateProcurementStage(order, action);
      case SupplyChainStage.SCHEDULING:
        return this.validateSchedulingStage(order, action);
      case SupplyChainStage.FULFILLMENT:
        return this.validateFulfillmentStage(order, action);
      default:
        return { allowed: false, reason: 'Unknown stage' };
    }
  }

  /**
   * Map database status to Supply Chain Stage
   */
  static getStageForStatus(status: OrderStatus): SupplyChainStage {
    switch (status) {
      case 'DRAFT':
      case 'TO_DO':
      case 'CALL_BACK':
      case 'PENDING_APPROVAL':
        return SupplyChainStage.PAYMENT;

      case 'CONFIRMED':
      case 'PO_CREATED':
      case 'AWAITING_STOCK':
      case 'PARTIALLY_SUPPLIED':
      case 'SUPPLIED':
        return SupplyChainStage.PROCUREMENT;

      case 'READY_FOR_INSTALL':
      case 'INSTALL_SCHEDULING':
      case 'SCHEDULED':
        return SupplyChainStage.SCHEDULING;

      case 'AWAITING_INSTALL':
      case 'COMPLETED':
      case 'INVOICED':
      case 'CANCELLED':
        return SupplyChainStage.FULFILLMENT;

      default:
        return SupplyChainStage.PAYMENT; // Default fallback
    }
  }

  private static hasPermission(role: string, action: SupplyChainAction): boolean {
    const isAdmin = role === 'ADMIN';
    if (isAdmin) return true;

    // Role-based logic mapping
    // Can be expanded based on specific RBAC needs
    return true;
  }

  private static validatePaymentStage(order: Order, action: SupplyChainAction): StatusGuardResult {
    const validActions = [
      SupplyChainAction.RECORD_PAYMENT,
      SupplyChainAction.CANCEL_ORDER,
      SupplyChainAction.REQUEST_CALLBACK,
      SupplyChainAction.APPROVE_PHASE_TRANSITION,
    ];

    if (!validActions.includes(action)) {
      return { allowed: false, reason: 'Action not allowed in Payment stage' };
    }
    return { allowed: true };
  }

  private static validateProcurementStage(
    order: Order,
    action: SupplyChainAction
  ): StatusGuardResult {
    const validActions = [
      SupplyChainAction.CREATE_PURCHASE_ORDER,
      SupplyChainAction.MARK_IN_STOCK,
      SupplyChainAction.CONFIRM_RECEPTION,
      SupplyChainAction.REPORT_STOCK_ISSUE,
      SupplyChainAction.APPROVE_PHASE_TRANSITION,
    ];

    if (!validActions.includes(action)) {
      return { allowed: false, reason: 'Action not allowed in Procurement stage' };
    }
    return { allowed: true };
  }

  private static validateSchedulingStage(
    order: Order,
    action: SupplyChainAction
  ): StatusGuardResult {
    const validActions = [
      SupplyChainAction.SCHEDULE_INSTALLATION,
      SupplyChainAction.SCHEDULE_DELIVERY,
      SupplyChainAction.RESCHEDULE,
      SupplyChainAction.APPROVE_PHASE_TRANSITION,
    ];

    if (!validActions.includes(action)) {
      return { allowed: false, reason: 'Action not allowed in Scheduling stage' };
    }
    return { allowed: true };
  }

  private static validateFulfillmentStage(
    order: Order,
    action: SupplyChainAction
  ): StatusGuardResult {
    const validActions = [
      SupplyChainAction.COMPLETE_INSTALLATION,
      SupplyChainAction.FAIL_INSTALLATION,
      SupplyChainAction.APPROVE_PHASE_TRANSITION,
    ];

    if (!validActions.includes(action)) {
      return { allowed: false, reason: 'Action not allowed in Fulfillment stage' };
    }
    return { allowed: true };
  }
}
