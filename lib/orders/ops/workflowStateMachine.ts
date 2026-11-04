import type { OrderStatus } from '@prisma/client';

export type OpsWorkflowAction =
  | 'accept-to-production'
  | 'goods-accepted'
  | 'mark-ready-delivery'
  | 'mark-customer-contacted'
  | 'mark-supplied'
  | 'awaiting-stock'
  | 'awaiting-customer';

interface ActionTransition {
  from: OrderStatus[];
  to: OrderStatus;
  requiresChecklistCompletion?: boolean;
  requiresEstimatedDays?: boolean;
}

const ACTION_TRANSITIONS: Record<OpsWorkflowAction, ActionTransition> = {
  'accept-to-production': {
    from: ['TO_DO', 'RECEIVED', 'PROCESSING', 'PO_CREATED'],
    to: 'AWAITING_STOCK',
    requiresChecklistCompletion: true,
    requiresEstimatedDays: true,
  },
  'goods-accepted': {
    from: ['AWAITING_STOCK', 'PARTIALLY_SUPPLIED'],
    to: 'INSTALL_SCHEDULING',
  },
  'mark-ready-delivery': {
    from: ['INSTALL_SCHEDULING', 'READY', 'READY_FOR_INSTALL'],
    to: 'AWAITING_INSTALL',
  },
  'mark-customer-contacted': {
    from: ['CALL_BACK', 'RECEIVED', 'TO_DO', 'PROCESSING', 'AWAITING_STOCK'],
    to: 'PROCESSING', // Or remains depending on logic, but state machine needs a 'to'
  },
  'mark-supplied': {
    from: ['AWAITING_INSTALL', 'SCHEDULED'],
    to: 'COMPLETED',
  },
  'awaiting-stock': {
    from: ['RECEIVED', 'TO_DO', 'PROCESSING'],
    to: 'AWAITING_STOCK',
  },
  'awaiting-customer': {
    from: ['RECEIVED', 'TO_DO', 'PROCESSING', 'AWAITING_STOCK'],
    to: 'CALL_BACK',
  },
};

export function getActionTransition(action: OpsWorkflowAction): ActionTransition {
  return ACTION_TRANSITIONS[action];
}

export function canExecuteAction(currentStatus: OrderStatus, action: OpsWorkflowAction): boolean {
  const transition = ACTION_TRANSITIONS[action];
  return transition.from.includes(currentStatus);
}
