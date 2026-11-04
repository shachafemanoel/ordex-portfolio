export enum SupplyChainStage {
  PAYMENT = 'PAYMENT',
  PROCUREMENT = 'PROCUREMENT',
  SCHEDULING = 'SCHEDULING',
  FULFILLMENT = 'FULFILLMENT',
}

export enum SupplyChainAction {
  // Payment Stage
  RECORD_PAYMENT = 'RECORD_PAYMENT',
  CANCEL_ORDER = 'CANCEL_ORDER',
  REQUEST_CALLBACK = 'REQUEST_CALLBACK',

  // Procurement Stage
  CREATE_PURCHASE_ORDER = 'CREATE_PURCHASE_ORDER',
  MARK_IN_STOCK = 'MARK_IN_STOCK',
  CONFIRM_RECEPTION = 'CONFIRM_RECEPTION',
  REPORT_STOCK_ISSUE = 'REPORT_STOCK_ISSUE',
  ASSIGN_SUPPLIER = 'ASSIGN_SUPPLIER', // Flexible Procurement

  // Scheduling Stage
  SCHEDULE_INSTALLATION = 'SCHEDULE_INSTALLATION',
  SCHEDULE_DELIVERY = 'SCHEDULE_DELIVERY',
  RESCHEDULE = 'RESCHEDULE',

  // Fulfillment Stage
  COMPLETE_INSTALLATION = 'COMPLETE_INSTALLATION',
  FAIL_INSTALLATION = 'FAIL_INSTALLATION',

  // Universal
  APPROVE_PHASE_TRANSITION = 'APPROVE_PHASE_TRANSITION',
  OVERRIDE_BLOCK = 'OVERRIDE_BLOCK',
  RESOLVE_EXCEPTION = 'RESOLVE_EXCEPTION',
}

export enum BlockedReasonCode {
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  SUPPLIER_DELAY = 'SUPPLIER_DELAY',
  CUSTOMER_CANCELLATION = 'CUSTOMER_CANCELLATION',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  INSTALLATION_FAILURE = 'INSTALLATION_FAILURE',
  OTHER = 'OTHER',
}

export interface SupplyChainContext {
  userId: string;
  userRole: string; // UserRole
}

export interface ActionPayload {
  action: SupplyChainAction;
  note?: string;
  metadata?: Record<string, any>;
}

export interface StatusGuardResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string[];
}
