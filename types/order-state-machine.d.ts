/**
 * Order State Machine and Lifecycle Management Types
 * Advanced discriminated unions and state transition modeling for Ordex OMS
 */

import type {
  Brand,
  DiscriminatedUnion,
  UnionByDiscriminator,
  ExhaustiveCheck,
  Switch,
  Match,
  Result
} from './utilities';
import type { OrderId, UserId, Timestamp } from '@/types/utilities';
import type { OrderStatus as PrismaOrderStatus } from '@prisma/client';

// ==================== ORDER STATUS TYPES ====================

/**
 * Re-export OrderStatus from Prisma to ensure type consistency with database
 */
export type OrderStatus = PrismaOrderStatus;

/**
 * Legacy status mapping for backward compatibility
 * Maps old spec statuses to canonical Prisma OrderStatus
 */
export const LEGACY_TO_PRISMA_STATUS: Record<string, OrderStatus> = {
  NEW: 'DRAFT',
  FOLLOW_UP: 'CONFIRMED',
  PO: 'AWAITING_STOCK',
  WAITING_GOODS: 'AWAITING_STOCK',
  PARTIAL: 'PARTIALLY_SUPPLIED',
  SCHEDULE: 'READY_FOR_INSTALL',
  WAITING_INSTALL: 'SCHEDULED',
  DONE: 'INSTALLED',
  CANCELLED: 'CANCELLED',
};

/**
 * Order status constants using Prisma enum values
 */
export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  CONFIRMED: 'CONFIRMED',
  READY_FOR_INSTALL: 'READY_FOR_INSTALL',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  INVOICED: 'INVOICED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, OrderStatus>;

/**
 * Status progression phases for logical grouping
 */
export type OrderPhase =
  | 'INITIATION'     // DRAFT, PENDING_APPROVAL, CONFIRMED
  | 'SCHEDULING'     // READY_FOR_INSTALL, SCHEDULED
  | 'COMPLETION'     // COMPLETED, INVOICED
  | 'TERMINATED';    // CANCELLED

/**
 * Map status to phase using Prisma OrderStatus enum values
 */
export const STATUS_TO_PHASE: Record<OrderStatus, OrderPhase> = {
  DRAFT: 'INITIATION',
  PENDING_APPROVAL: 'INITIATION',
  CONFIRMED: 'INITIATION',
  READY_FOR_INSTALL: 'SCHEDULING',
  SCHEDULED: 'SCHEDULING',
  COMPLETED: 'COMPLETION',
  INVOICED: 'COMPLETION',
  CANCELLED: 'TERMINATED',
};

// ==================== STATE-SPECIFIC DATA ====================

/**
 * Base order state interface
 */
interface BaseOrderState {
  readonly orderId: OrderId;
  readonly status: OrderStatus;
  readonly phase: OrderPhase;
  readonly enteredAt: Timestamp;
  readonly canTransitionTo: readonly OrderStatus[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Draft order state - initial creation
 */
export interface DraftOrderState extends BaseOrderState {
  readonly status: 'DRAFT';
  readonly phase: 'INITIATION';
  readonly canTransitionTo: readonly ['PENDING', 'CONFIRMED', 'AWAITING_STOCK', 'READY_FOR_INSTALL', 'CANCELLED'];
  readonly data: {
    readonly source: 'manual' | 'woocommerce' | 'api';
    readonly priority: 'low' | 'normal' | 'high' | 'urgent';
    readonly estimatedValue?: number;
  };
}

/**
 * Pending order state - awaiting confirmation
 */
export interface PendingOrderState extends BaseOrderState {
  readonly status: 'PENDING';
  readonly phase: 'INITIATION';
  readonly canTransitionTo: readonly ['DRAFT', 'CONFIRMED', 'CANCELLED'];
  readonly data: {
    readonly awaitingApproval: boolean;
    readonly approvalDeadline?: Timestamp;
  };
}

/**
 * Confirmed order state - customer confirmed, awaiting processing
 */
export interface ConfirmedOrderState extends BaseOrderState {
  readonly status: 'CONFIRMED';
  readonly phase: 'INITIATION';
  readonly canTransitionTo: readonly ['DRAFT', 'AWAITING_STOCK', 'READY_FOR_INSTALL', 'INSTALLED', 'CANCELLED'];
  readonly data: {
    readonly lastContactAt: Timestamp;
    readonly nextFollowUpAt?: Timestamp;
    readonly contactAttempts: number;
    readonly contactMethod: 'phone' | 'email' | 'whatsapp' | 'sms';
    readonly reason: string;
  };
}

/**
 * Awaiting Stock state - PO created, awaiting supplier delivery
 */
export interface AwaitingStockOrderState extends BaseOrderState {
  readonly status: 'AWAITING_STOCK';
  readonly phase: 'PROCUREMENT';
  readonly canTransitionTo: readonly ['PARTIALLY_SUPPLIED', 'READY_FOR_INSTALL', 'CANCELLED'];
  readonly data: {
    readonly purchaseOrderId: string;
    readonly supplierId: string;
    readonly poNumber: string;
    readonly poDate: Timestamp;
    readonly expectedDeliveryDate?: Timestamp;
    readonly totalAmount: number;
    readonly trackingNumbers?: readonly string[];
    readonly supplierEstimate?: string;
    readonly daysWaiting: number;
  };
}

/**
 * Partially Supplied state - some items received
 */
export interface PartiallySuppliedOrderState extends BaseOrderState {
  readonly status: 'PARTIALLY_SUPPLIED';
  readonly phase: 'PROCUREMENT';
  readonly canTransitionTo: readonly ['AWAITING_STOCK', 'READY_FOR_INSTALL', 'CANCELLED'];
  readonly data: {
    readonly purchaseOrderId: string;
    readonly itemsReceived: readonly {
      readonly productId: string;
      readonly quantityReceived: number;
      readonly quantityOrdered: number;
      readonly receivedAt: Timestamp;
    }[];
    readonly pendingItems: readonly {
      readonly productId: string;
      readonly quantityPending: number;
      readonly expectedDate?: Timestamp;
    }[];
    readonly canProceedPartially: boolean;
  };
}

/**
 * Ready for Install state - ready for installation scheduling
 */
export interface ReadyForInstallOrderState extends BaseOrderState {
  readonly status: 'READY_FOR_INSTALL';
  readonly phase: 'SCHEDULING';
  readonly canTransitionTo: readonly ['SCHEDULED', 'CANCELLED'];
  readonly data: {
    readonly allItemsReceived: boolean;
    readonly preferredTimeSlots?: readonly {
      readonly start: Timestamp;
      readonly end: Timestamp;
      readonly preference: 'preferred' | 'acceptable' | 'avoid';
    }[];
    readonly siteRequirements?: {
      readonly accessType: 'stairs' | 'elevator' | 'ground_floor';
      readonly parkingAvailable: boolean;
      readonly specialEquipmentNeeded?: readonly string[];
    };
    readonly estimatedDuration?: number; // minutes
  };
}

/**
 * Scheduled state - installation scheduled, awaiting completion
 */
export interface ScheduledOrderState extends BaseOrderState {
  readonly status: 'SCHEDULED';
  readonly phase: 'SCHEDULING';
  readonly canTransitionTo: readonly ['INSTALLING', 'READY_FOR_INSTALL', 'CANCELLED'];
  readonly data: {
    readonly scheduledAt: Timestamp;
    readonly scheduledEndAt?: Timestamp;
    readonly installerId?: UserId;
    readonly installerName?: string;
    readonly calendarEventId?: string;
    readonly customerConfirmed: boolean;
    readonly remindersSent: readonly Timestamp[];
    readonly specialInstructions?: string;
  };
}

/**
 * Installing state - installation in progress
 */
export interface InstallingOrderState extends BaseOrderState {
  readonly status: 'INSTALLING';
  readonly phase: 'FULFILLMENT';
  readonly canTransitionTo: readonly ['INSTALLED', 'SCHEDULED', 'CANCELLED'];
  readonly data: {
    readonly startedAt: Timestamp;
    readonly installerId?: UserId;
    readonly installerName?: string;
    readonly progressNotes?: string;
  };
}

/**
 * Installed state - installation completed
 */
export interface InstalledOrderState extends BaseOrderState {
  readonly status: 'INSTALLED';
  readonly phase: 'COMPLETION';
  readonly canTransitionTo: readonly ['INVOICED', 'COMPLETED', 'CANCELLED'];
  readonly data: {
    readonly completedAt: Timestamp;
    readonly completedBy?: UserId;
    readonly customerSatisfaction?: 1 | 2 | 3 | 4 | 5;
    readonly completionNotes?: string;
    readonly photoUrls?: readonly string[];
  };
}

/**
 * Invoiced state - invoice sent to customer
 */
export interface InvoicedOrderState extends BaseOrderState {
  readonly status: 'INVOICED';
  readonly phase: 'COMPLETION';
  readonly canTransitionTo: readonly ['COMPLETED', 'CANCELLED'];
  readonly data: {
    readonly invoicedAt: Timestamp;
    readonly invoiceNumber?: string;
    readonly finalInvoiceAmount?: number;
    readonly paymentDueDate?: Timestamp;
  };
}

/**
 * Completed state - order fully completed
 */
export interface CompletedOrderState extends BaseOrderState {
  readonly status: 'COMPLETED';
  readonly phase: 'COMPLETION';
  readonly canTransitionTo: readonly ['CLOSED', 'REFUNDED'];
  readonly data: {
    readonly completedAt: Timestamp;
    readonly finalAmount: number;
    readonly warrantyExpiresAt?: Timestamp;
  };
}

/**
 * Closed state - order archived
 */
export interface ClosedOrderState extends BaseOrderState {
  readonly status: 'CLOSED';
  readonly phase: 'COMPLETION';
  readonly canTransitionTo: readonly [];
  readonly data: {
    readonly closedAt: Timestamp;
    readonly closedBy?: UserId;
    readonly archiveReason?: string;
  };
}

/**
 * On Hold state - order temporarily suspended
 */
export interface OnHoldOrderState extends BaseOrderState {
  readonly status: 'ON_HOLD';
  readonly phase: 'TERMINATED';
  readonly canTransitionTo: readonly ['DRAFT', 'CONFIRMED', 'AWAITING_STOCK', 'CANCELLED'];
  readonly data: {
    readonly heldAt: Timestamp;
    readonly heldBy?: UserId;
    readonly reason: string;
    readonly expectedResumeDate?: Timestamp;
  };
}

/**
 * Canceled state - order terminated
 */
export interface CanceledOrderState extends BaseOrderState {
  readonly status: 'CANCELLED';
  readonly phase: 'TERMINATED';
  readonly canTransitionTo: readonly [];
  readonly data: {
    readonly canceledAt: Timestamp;
    readonly canceledBy?: UserId;
    readonly reason: 'customer_request' | 'supplier_issue' | 'payment_issue' | 'logistics_issue' | 'other';
    readonly refundRequired: boolean;
    readonly refundAmount?: number;
    readonly notes?: string;
  };
}

/**
 * Refunded state - order refunded
 */
export interface RefundedOrderState extends BaseOrderState {
  readonly status: 'REFUNDED';
  readonly phase: 'TERMINATED';
  readonly canTransitionTo: readonly [];
  readonly data: {
    readonly refundedAt: Timestamp;
    readonly refundedBy?: UserId;
    readonly refundAmount: number;
    readonly refundReason: string;
    readonly refundReference?: string;
  };
}

// ==================== DISCRIMINATED UNION ====================

/**
 * Complete order state as discriminated union using Prisma OrderStatus
 */
export type OrderState =
  | DraftOrderState
  | PendingOrderState
  | ConfirmedOrderState
  | AwaitingStockOrderState
  | PartiallySuppliedOrderState
  | ReadyForInstallOrderState
  | ScheduledOrderState
  | InstallingOrderState
  | InstalledOrderState
  | InvoicedOrderState
  | CompletedOrderState
  | ClosedOrderState
  | OnHoldOrderState
  | CanceledOrderState
  | RefundedOrderState;

/**
 * Extract state by status type
 */
export type OrderStateByStatus<TStatus extends OrderStatus> = 
  Extract<OrderState, { status: TStatus }>;

/**
 * Extract state data by status
 */
export type OrderStateData<TStatus extends OrderStatus> = 
  OrderStateByStatus<TStatus>['data'];

// ==================== TRANSITION TYPES ====================

/**
 * Base transition interface
 */
interface BaseTransition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly triggeredBy: UserId;
  readonly triggeredAt: Timestamp;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Status-specific transition requirements using Prisma OrderStatus
 */
export type TransitionRequirements<TFrom extends OrderStatus, TTo extends OrderStatus> =
  TFrom extends 'DRAFT'
    ? TTo extends 'AWAITING_STOCK'
      ? { readonly supplierValidated: true; readonly itemsWithSuppliers: true }
      : TTo extends 'READY_FOR_INSTALL'
      ? { readonly allItemsAvailable: true }
      : {}
    : TFrom extends 'CONFIRMED'
    ? TTo extends 'AWAITING_STOCK'
      ? { readonly supplierValidated: true; readonly itemsWithSuppliers: true }
      : TTo extends 'READY_FOR_INSTALL'
      ? { readonly allItemsAvailable: true }
      : {}
    : TFrom extends 'AWAITING_STOCK'
    ? TTo extends 'PARTIALLY_SUPPLIED'
      ? { readonly someItemsReceived: true }
      : TTo extends 'READY_FOR_INSTALL'
      ? { readonly allItemsReceived: true }
      : {}
    : TFrom extends 'PARTIALLY_SUPPLIED'
    ? TTo extends 'READY_FOR_INSTALL'
      ? { readonly minimumItemsReceived: true } | { readonly customerApprovedPartial: true }
      : {}
    : TFrom extends 'READY_FOR_INSTALL'
    ? TTo extends 'SCHEDULED'
      ? { readonly installationScheduled: true; readonly installerAssigned: true }
      : {}
    : TFrom extends 'SCHEDULED'
    ? TTo extends 'INSTALLING'
      ? { readonly installerOnSite: true }
      : {}
    : TFrom extends 'INSTALLING'
    ? TTo extends 'INSTALLED'
      ? { readonly installationCompleted: true; readonly customerSignedOff: true }
      : {}
    : TFrom extends 'INSTALLED'
    ? TTo extends 'INVOICED'
      ? { readonly invoiceGenerated: true }
      : TTo extends 'COMPLETED'
      ? { readonly paymentReceived: true }
      : {}
    : {};

/**
 * Typed transition with requirements
 */
export interface OrderTransition<TFrom extends OrderStatus, TTo extends OrderStatus> extends BaseTransition {
  readonly from: TFrom;
  readonly to: TTo;
  readonly requirements: TransitionRequirements<TFrom, TTo>;
  readonly effects?: readonly TransitionEffect[];
}

/**
 * Side effects of transitions
 */
export interface TransitionEffect {
  readonly type: 'notification' | 'calendar_event' | 'purchase_order' | 'invoice' | 'audit_log';
  readonly target?: string;
  readonly payload: Record<string, unknown>;
}

// ==================== STATE MACHINE ====================

/**
 * Order state machine configuration
 */
export interface OrderStateMachineConfig {
  readonly transitions: Record<OrderStatus, readonly OrderStatus[]>;
  readonly validators: Record<OrderStatus, (state: OrderState) => Promise<Result<void, ValidationError[]>>>;
  readonly effects: Record<`${OrderStatus}->${OrderStatus}`, readonly TransitionEffect[]>;
}

/**
 * State machine interface
 */
export interface OrderStateMachine {
  readonly getCurrentState: (orderId: OrderId) => Promise<Result<OrderState, Error>>;
  readonly canTransition: (from: OrderStatus, to: OrderStatus) => boolean;
  readonly validateTransition: <TFrom extends OrderStatus, TTo extends OrderStatus>(
    transition: OrderTransition<TFrom, TTo>
  ) => Promise<Result<void, ValidationError[]>>;
  readonly executeTransition: <TFrom extends OrderStatus, TTo extends OrderStatus>(
    transition: OrderTransition<TFrom, TTo>
  ) => Promise<Result<OrderState, Error>>;
  readonly getTransitionHistory: (orderId: OrderId) => Promise<Result<readonly BaseTransition[], Error>>;
}

/**
 * Validation error for state transitions
 */
export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly context?: Record<string, unknown>;
}

// ==================== QUERY HELPERS ====================

/**
 * State machine query helpers
 */
export interface OrderStateMachineQueries {
  readonly getOrdersByStatus: <TStatus extends OrderStatus>(
    status: TStatus
  ) => Promise<Result<readonly OrderStateByStatus<TStatus>[], Error>>;
  
  readonly getOrdersByPhase: (
    phase: OrderPhase
  ) => Promise<Result<readonly OrderState[], Error>>;
  
  readonly getStuckOrders: (
    thresholdDays: number
  ) => Promise<Result<readonly {
    readonly order: OrderState;
    readonly daysInStatus: number;
    readonly suggestedAction?: string;
  }[], Error>>;
  
  readonly getTransitionStats: (
    dateRange: { readonly from: Timestamp; readonly to: Timestamp }
  ) => Promise<Result<Record<`${OrderStatus}->${OrderStatus}`, number>, Error>>;
}

// ==================== TYPE GUARDS ====================

/**
 * Type guard functions for order states using Prisma OrderStatus
 */
export const isOrderState = {
  draft: (state: OrderState): state is DraftOrderState => state.status === 'DRAFT',
  pending: (state: OrderState): state is PendingOrderState => state.status === 'PENDING',
  confirmed: (state: OrderState): state is ConfirmedOrderState => state.status === 'CONFIRMED',
  awaitingStock: (state: OrderState): state is AwaitingStockOrderState => state.status === 'AWAITING_STOCK',
  partiallySupplied: (state: OrderState): state is PartiallySuppliedOrderState => state.status === 'PARTIALLY_SUPPLIED',
  readyForInstall: (state: OrderState): state is ReadyForInstallOrderState => state.status === 'READY_FOR_INSTALL',
  scheduled: (state: OrderState): state is ScheduledOrderState => state.status === 'SCHEDULED',
  installing: (state: OrderState): state is InstallingOrderState => state.status === 'INSTALLING',
  installed: (state: OrderState): state is InstalledOrderState => state.status === 'INSTALLED',
  invoiced: (state: OrderState): state is InvoicedOrderState => state.status === 'INVOICED',
  completed: (state: OrderState): state is CompletedOrderState => state.status === 'COMPLETED',
  closed: (state: OrderState): state is ClosedOrderState => state.status === 'CLOSED',
  onHold: (state: OrderState): state is OnHoldOrderState => state.status === 'ON_HOLD',
  canceled: (state: OrderState): state is CanceledOrderState => state.status === 'CANCELLED',
  refunded: (state: OrderState): state is RefundedOrderState => state.status === 'REFUNDED',
} as const;

// ==================== WORKFLOW PATTERNS ====================

/**
 * Workflow step for complex order processing
 */
export interface OrderWorkflowStep<TState extends OrderState = OrderState> {
  readonly name: string;
  readonly condition?: (state: TState) => Promise<boolean>;
  readonly execute: (state: TState) => Promise<Result<OrderState, Error>>;
  readonly compensate?: (state: TState) => Promise<Result<void, Error>>;
  readonly timeout?: number; // milliseconds
}

/**
 * Complete order workflow
 */
export interface OrderWorkflow<TInitialState extends OrderState = OrderState> {
  readonly name: string;
  readonly description: string;
  readonly steps: readonly OrderWorkflowStep<any>[];
  readonly execute: (initialState: TInitialState) => Promise<Result<OrderState, Error>>;
}

/**
 * Predefined workflows for common order patterns using Prisma OrderStatus
 */
export interface OrderWorkflowLibrary {
  readonly simpleOrder: OrderWorkflow<DraftOrderState>; // DRAFT -> READY_FOR_INSTALL -> SCHEDULED -> INSTALLING -> INSTALLED
  readonly purchaseOrder: OrderWorkflow<DraftOrderState>; // DRAFT -> AWAITING_STOCK -> READY_FOR_INSTALL -> SCHEDULED -> INSTALLED
  readonly partialOrder: OrderWorkflow<PartiallySuppliedOrderState>; // Handle partial deliveries
  readonly expeditedOrder: OrderWorkflow<DraftOrderState>; // Fast-track for urgent orders
  readonly confirmedWorkflow: OrderWorkflow<ConfirmedOrderState>; // Customer confirmed automation
}

// ==================== EVENT SOURCING INTEGRATION ====================

/**
 * Order state changed domain event
 */
export interface OrderStateChangedEvent {
  readonly type: 'OrderStateChanged';
  readonly orderId: OrderId;
  readonly fromState: OrderStatus;
  readonly toState: OrderStatus;
  readonly transition: BaseTransition;
  readonly stateData: OrderState['data'];
  readonly timestamp: Timestamp;
}

/**
 * Order workflow completed domain event
 */
export interface OrderWorkflowCompletedEvent {
  readonly type: 'OrderWorkflowCompleted';
  readonly orderId: OrderId;
  readonly workflowName: string;
  readonly finalState: OrderStatus;
  readonly duration: number; // milliseconds
  readonly stepsExecuted: number;
  readonly timestamp: Timestamp;
}

/**
 * All order-related domain events
 */
export type OrderDomainEvent = 
  | OrderStateChangedEvent
  | OrderWorkflowCompletedEvent;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Exhaustive status checking - ensures all statuses are handled
 */
export function exhaustiveStatusCheck(status: never): never {
  throw new Error(`Unhandled order status: ${status}`);
}

/**
 * Status progression helper - calculates completion percentage using Prisma OrderStatus
 */
export function calculateOrderProgress(status: OrderStatus): number {
  const progressMap: Record<OrderStatus, number> = {
    DRAFT: 0,
    PENDING: 5,
    CONFIRMED: 10,
    AWAITING_STOCK: 25,
    PARTIALLY_SUPPLIED: 40,
    READY_FOR_INSTALL: 55,
    SCHEDULED: 70,
    INSTALLING: 80,
    INSTALLED: 90,
    INVOICED: 95,
    COMPLETED: 100,
    CLOSED: 100,
    ON_HOLD: 0,
    CANCELLED: 0,
    REFUNDED: 0,
  };

  return progressMap[status];
}

/**
 * Next possible transitions for a status using Prisma OrderStatus
 */
export function getNextTransitions(status: OrderStatus): readonly OrderStatus[] {
  const transitionMap: Record<OrderStatus, readonly OrderStatus[]> = {
    DRAFT: ['PENDING', 'CONFIRMED', 'AWAITING_STOCK', 'READY_FOR_INSTALL', 'CANCELLED'],
    PENDING: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['DRAFT', 'AWAITING_STOCK', 'READY_FOR_INSTALL', 'INSTALLED', 'CANCELLED'],
    AWAITING_STOCK: ['PARTIALLY_SUPPLIED', 'READY_FOR_INSTALL', 'CANCELLED'],
    PARTIALLY_SUPPLIED: ['AWAITING_STOCK', 'READY_FOR_INSTALL', 'CANCELLED'],
    READY_FOR_INSTALL: ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['INSTALLING', 'READY_FOR_INSTALL', 'CANCELLED'],
    INSTALLING: ['INSTALLED', 'SCHEDULED', 'CANCELLED'],
    INSTALLED: ['INVOICED', 'COMPLETED', 'CANCELLED'],
    INVOICED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['CLOSED', 'REFUNDED'],
    CLOSED: [],
    ON_HOLD: ['DRAFT', 'CONFIRMED', 'AWAITING_STOCK', 'CANCELLED'],
    CANCELLED: [],
    REFUNDED: [],
  };

  return transitionMap[status];
}
