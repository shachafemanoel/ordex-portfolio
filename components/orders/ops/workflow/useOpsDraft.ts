import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'ops-workflow-draft-';

interface OpsDraftState {
  intakeDecisions: Record<string, any>;
  poSelectedItemIds: string[];
  poExpectedDate: string;
  poSupplierDetails: string;
  poNotes: string;
  supplierByItemId: Record<string, string>;
  scheduleNotes: string;
  scheduledDate: string;
  scheduleWindow: string;
}

export function useOpsDraft(orderId: string | null) {
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftState, setDraftState] = useState<Partial<OpsDraftState>>({});

  // Load from local storage
  useEffect(() => {
    if (!orderId) return;
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${orderId}`);
      if (saved) {
        setDraftState(JSON.parse(saved));
      }
      setDraftLoaded(true);
    } catch (e) {
      console.error('Failed to load draft state', e);
      setDraftLoaded(true);
    }
  }, [orderId]);

  // Save to local storage
  const saveDraft = useCallback((state: Partial<OpsDraftState>) => {
    if (!orderId) return;
    localStorage.setItem(`${STORAGE_PREFIX}${orderId}`, JSON.stringify(state));
  }, [orderId]);

  const clearDraft = useCallback(() => {
    if (!orderId) return;
    localStorage.removeItem(`${STORAGE_PREFIX}${orderId}`);
  }, [orderId]);

  return { draftState, draftLoaded, saveDraft, clearDraft };
}
