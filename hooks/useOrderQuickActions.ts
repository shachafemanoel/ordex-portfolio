'use client';

/**
 * useOrderQuickActions
 *
 * Returns contextual quick actions from a single canonical execution resolver.
 */

import { useChangeOrderStatusMutation } from '@/lib/hooks/api/orders';
import {
  resolveOrderExecutionQuickActions,
  type ResolvedOrderQuickAction,
} from '@/lib/orders/executionFlow';
import type { OrderStatus } from '@prisma/client';
import type { ElementType } from 'react';

export type QuickActionIntent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface OrderQuickAction {
  id: string;
  label: string;
  labelEn: string;
  icon: ElementType;
  intent: QuickActionIntent;
  /** If provided, clicking the action triggers an inline status change. */
  targetStatus?: OrderStatus;
  /** If provided, clicking opens this URL instead. */
  href?: string;
  /** Whether this action is intentionally not executable inline. */
  disabled?: boolean;
  disabledReason?: string;
  /** Whether the action is destructive / needs a confirmation step. */
  requiresConfirm?: boolean;
}

function toQuickAction(action: ResolvedOrderQuickAction): OrderQuickAction {
  return {
    id: action.id,
    label: action.label,
    labelEn: action.labelEn,
    icon: action.icon,
    intent: action.intent,
    targetStatus: action.targetStatus,
    href: action.href,
    disabled: action.disabled,
    disabledReason: action.disabledReason,
    requiresConfirm: action.requiresConfirm,
  };
}

export interface UseOrderQuickActionsReturn {
  actions: OrderQuickAction[];
  primaryAction: OrderQuickAction | null;
  /** Execute the action (triggers status change if applicable). */
  execute: (action: OrderQuickAction) => Promise<void>;
  isPending: boolean;
  pendingActionId: string | null;
}

export function useOrderQuickActions(
  orderId: string,
  rawStatus: string
): UseOrderQuickActionsReturn {
  const mutation = useChangeOrderStatusMutation(orderId);

  const actions: OrderQuickAction[] = resolveOrderExecutionQuickActions({ orderId, rawStatus }).map(
    toQuickAction
  );

  const primaryAction = actions[0] ?? null;

  const execute = async (action: OrderQuickAction) => {
    if (action.disabled || action.href) return;
    if (!action.targetStatus) return;
    await mutation.mutateAsync({ status: action.targetStatus });
  };

  return {
    actions,
    primaryAction,
    execute,
    isPending: mutation.isPending,
    pendingActionId: mutation.isPending ? (mutation.variables?.status ?? null) : null,
  };
}
