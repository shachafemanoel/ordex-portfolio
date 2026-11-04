/**
 * useOpsActions.ts
 *
 * React hook for managing OpsActions
 * Provides functions to interact with OpsAction API endpoints
 */

import type { OpsActionStatus, OpsActionStep, OpsActionType } from '@prisma/client';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

interface SupplierOption {
  id: string;
  name: string;
}

interface OpsAction {
  id: string;
  orderId: string;
  type: OpsActionType;
  status: OpsActionStatus;
  step: OpsActionStep;
  cursor: number;
  context: any;
  lastNotifiedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: string;
    orderNumber: string | null;
    customer: {
      name: string;
    };
    items: Array<{
      id: string;
      qty: number;
      supplier: {
        id: string;
        name: string;
      } | null;
      product: {
        name: string;
        productSuppliers: Array<{
          supplier: SupplierOption;
        }>;
      } | null;
      supplierId: string | null;
    }>;
  };
}

interface OpsActionResponse {
  success: boolean;
  data: {
    actionId: string;
    status: OpsActionStatus;
    step: OpsActionStep;
    messageText: string | null;
    done: boolean;
    alreadyExists?: boolean;
  };
}

function extractErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.detail === 'string') return payload.detail;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error === 'object') {
    if (typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.error.detail === 'string') return payload.error.detail;
    if (typeof payload.error.code === 'string') return payload.error.code;
  }
  return fallback;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(extractErrorMessage(json, `Request failed: ${response.status}`));
  }
  return json;
};

export function useOpsActions(orderId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultFromPhone = process.env.NEXT_PUBLIC_OPS_MANAGER_PHONE || 'UI_MANAGER';

  // Fetch OpsActions for an order
  const {
    data,
    error: swrError,
    mutate,
  } = useSWR<{
    success: boolean;
    data: OpsAction[];
  }>(orderId ? `/api/ops-actions?orderId=${orderId}` : null, fetcher, {
    refreshInterval: 30000, // Refresh every 30s
    revalidateOnFocus: true,
  });

  /**
   * Create a purchase approval action for an order
   */
  const createPurchaseApproval = useCallback(
    async (orderId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ops-actions/from-order-created', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });

        const result: OpsActionResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(extractErrorMessage(result, 'Failed to create purchase approval action'));
        }

        mutate(); // Refresh the list
        return result.data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate]
  );

  /**
   * Manually create an OpsAction (e.g. from a UI trigger button)
   */
  const triggerManualAction = useCallback(
    async (orderId: string, type: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ops-actions/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, type }),
        });

        const result: OpsActionResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(extractErrorMessage(result, 'Failed to trigger manual action'));
        }

        mutate(); // Refresh the list
        return result.data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate]
  );

  /**
   * Send a reply to an OpsAction (state machine)
   */
  const sendReply = useCallback(
    async (actionId: string, text: string, fromPhone: string = defaultFromPhone) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/ops-actions/${actionId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromPhone, text }),
        });

        const result: OpsActionResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(extractErrorMessage(result, 'Failed to process reply'));
        }

        mutate(); // Refresh the list
        return result.data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultFromPhone, mutate]
  );

  /**
   * Approve purchase (reply "1")
   */
  const approve = useCallback(
    async (actionId: string) => {
      return sendReply(actionId, '1');
    },
    [sendReply]
  );

  /**
   * Cancel purchase (reply "2")
   */
  const cancel = useCallback(
    async (actionId: string) => {
      return sendReply(actionId, '2');
    },
    [sendReply]
  );

  /**
   * Snooze action (reply "3")
   */
  const snooze = useCallback(
    async (actionId: string) => {
      return sendReply(actionId, '3');
    },
    [sendReply]
  );

  /**
   * Choose supplier (reply letter "A", "B", "C", etc.)
   */
  const chooseSupplier = useCallback(
    async (actionId: string, letter: string) => {
      return sendReply(actionId, letter.toUpperCase());
    },
    [sendReply]
  );

  /**
   * Persist delivery estimate for selected items
   */
  const setDeliveryDate = useCallback(
    async (actionId: string, date: Date, itemIds?: string[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/ops-actions/${actionId}/delivery-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: date.toISOString(),
            itemIds,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(extractErrorMessage(result, 'Failed to set delivery date'));
        }

        mutate();
        return result.data as {
          actionId: string;
          orderId: string;
          updatedItems: number;
          estimatedSupplyAt: string;
        };
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate]
  );

  /**
   * Run stuck orders scan (cron job)
   */
  const runStuckOrdersScan = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ops-actions/stuck-orders/run', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(extractErrorMessage(result, 'Failed to run stuck orders scan'));
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get action details
   */
  const getAction = useCallback(
    (actionId: string): OpsAction | undefined => {
      return data?.data.find((action) => action.id === actionId);
    },
    [data]
  );

  /**
   * Get all actions for current order
   */
  const actions = data?.data || [];

  /**
   * Get OPEN actions only
   */
  const openActions = actions.filter((action) => action.status === 'OPEN');

  /**
   * Get SNOOZED actions
   */
  const snoozedActions = actions.filter((action) => action.status === 'SNOOZED');

  return {
    actions,
    openActions,
    snoozedActions,
    isLoading: isLoading || !data,
    error: error || swrError,
    createPurchaseApproval,
    triggerManualAction,
    sendReply,
    approve,
    cancel,
    snooze,
    chooseSupplier,
    setDeliveryDate,
    runStuckOrdersScan,
    getAction,
    refresh: mutate,
  };
}

/**
 * Hook for a single OpsAction by ID
 */
export function useOpsAction(actionId: string) {
  const { data, error, mutate } = useSWR<{
    success: boolean;
    data: OpsAction;
  }>(actionId ? `/api/ops-actions/${actionId}` : null, fetcher, {
    refreshInterval: 10000, // Refresh every 10s for active actions
    revalidateOnFocus: true,
  });

  return {
    action: data?.data,
    isLoading: !data && !error,
    error,
    refresh: mutate,
  };
}
