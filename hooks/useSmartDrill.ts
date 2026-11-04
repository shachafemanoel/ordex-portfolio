'use client';

import { DrillState } from '@/lib/services/orders-ops';
import { useCallback } from 'react';
import useSWR from 'swr';

const CANONICAL_ACTION_IDS = [
  'accept-to-production',
  'goods-accepted',
  'mark-ready-delivery',
  'send-to-supplier',
  'mark-customer-contacted',
  'mark-supplied',
  'awaiting-stock',
  'awaiting-customer',
  'update-address',
  'update-payment',
  'schedule-installation',
  'force-approve-preparation',
] as const;

type CanonicalActionId = (typeof CANONICAL_ACTION_IDS)[number];

const LEGACY_ACTION_ALIASES: Record<string, CanonicalActionId> = {
  'create-purchase-order': 'accept-to-production',
  'approve-items': 'accept-to-production',
  'receive-goods': 'goods-accepted',
};

function normalizeActionId(actionId: string): CanonicalActionId | null {
  if ((CANONICAL_ACTION_IDS as readonly string[]).includes(actionId)) {
    return actionId as CanonicalActionId;
  }
  return LEGACY_ACTION_ALIASES[actionId] ?? null;
}

function normalizeEstimatedDays(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 60) {
    return Math.trunc(numericValue);
  }
  return 3;
}

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;

  const detailObj = details as {
    formErrors?: unknown;
    fieldErrors?: Record<string, unknown>;
  };

  const chunks: string[] = [];

  if (Array.isArray(detailObj.formErrors)) {
    const formErrors = detailObj.formErrors.filter(
      (entry): entry is string => typeof entry === 'string'
    );
    if (formErrors.length > 0) chunks.push(formErrors.join(', '));
  }

  if (detailObj.fieldErrors && typeof detailObj.fieldErrors === 'object') {
    for (const [field, value] of Object.entries(detailObj.fieldErrors)) {
      if (!Array.isArray(value)) continue;
      const errors = value.filter((entry): entry is string => typeof entry === 'string');
      if (errors.length > 0) {
        chunks.push(`${field}: ${errors.join(', ')}`);
      }
    }
  }

  return chunks.length > 0 ? chunks.join(' | ') : null;
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  let payload: any = null;

  try {
    payload = await res.clone().json();
  } catch {
    payload = null;
  }

  if (payload) {
    if (typeof payload === 'string') return payload;
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.detail === 'string') return payload.detail;

    if (typeof payload.error === 'string') return payload.error;

    if (payload.error && typeof payload.error === 'object') {
      if (typeof payload.error.message === 'string') {
        const details = formatValidationDetails(payload.error.details);
        if (details) return `${payload.error.message} (${details})`;
        return payload.error.message;
      }
      if (typeof payload.error.detail === 'string') return payload.error.detail;
      if (typeof payload.error.code === 'string') return payload.error.code;
    }

    const details =
      formatValidationDetails(payload.error?.details) ??
      formatValidationDetails(payload.details) ??
      formatValidationDetails(payload.detail);
    if (details) return details;
  }

  const text = await res.text().catch(() => '');
  if (text) return text;

  return fallback;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to load Smart Drill'));
  }
  return res.json();
};

export function useSmartDrill(orderId: string) {
  const { data, error, mutate } = useSWR<DrillState>(
    orderId ? `/api/orders/${orderId}/drill` : null,
    fetcher
  );

  const updateChecklist = useCallback(
    async (taskLabel: string, stepId: string, checked: boolean) => {
      const res = await fetch(`/api/orders/${orderId}/drill/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskLabel, stepId, checked }),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to update checklist'));
      const newState = await res.json();
      mutate(newState, false); // Update SWR cache
    },
    [orderId, mutate]
  );

  const snooze = useCallback(
    async (until: Date, reason?: string) => {
      const res = await fetch(`/api/orders/${orderId}/drill/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until: until.toISOString(), reason }),
      });
      if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to snooze'));
      const newState = await res.json();
      mutate(newState, false);
    },
    [orderId, mutate]
  );

  const wake = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/drill/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to wake'));
    const newState = await res.json();
    mutate(newState, false);
  }, [orderId, mutate]);

  const performAction = useCallback(
    async (actionId: string, payload?: Record<string, unknown>) => {
      const normalizedActionId = normalizeActionId(actionId);
      if (!normalizedActionId) {
        throw new Error(
          `Unsupported action "${actionId}". Supported actions: ${CANONICAL_ACTION_IDS.join(', ')}`
        );
      }

      const normalizedPayload: Record<string, unknown> = { ...(payload ?? {}) };
      if (normalizedActionId === 'accept-to-production') {
        normalizedPayload.estimatedDays = normalizeEstimatedDays(normalizedPayload.estimatedDays);
      }

      const res = await fetch(`/api/orders/${orderId}/drill/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: normalizedActionId, ...normalizedPayload }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, 'Failed to perform action'));
      }

      const json = await res.json();
      // Support both direct return and { success: true, data: ... } wrapper
      if (json.drillState) {
        mutate(json.drillState, false);
      } else if (json.data && json.data.drillState) {
        mutate(json.data.drillState, false);
      } else {
        // Fallback: re-fetch
        mutate();
      }
    },
    [orderId, mutate]
  );

  return {
    drillState: data,
    isLoading: !data && !error,
    isError: error,
    updateChecklist,
    snooze,
    wake,
    performAction,
  };
}
