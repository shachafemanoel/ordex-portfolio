import { useToast } from '@/components/ui/use-toast';
import type { OrderStatus } from '@prisma/client';
import { useOrderQuery } from '@/lib/hooks/api/orders/useOrderQuery';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  BatchAllocationUpdate,
  IntakeDecision,
  OrderOpsData,
  OrderPhase,
  WorkflowFocus,
  WorkflowPrimaryTab,
  WorkflowTab,
} from './types';
import { useOpsDraft } from './useOpsDraft';
import { useSuppliers } from './useSuppliers';
import {
  buildIntakeDecisionsFromItems,
  buildScheduleAddressPayload,
  buildScheduleWindowPayload,
  deriveScheduleWindowValue,
  getDefaultScheduleDateValue,
  getDefaultScheduleWindowValue,
  normalizeOrderItems,
  toDateInputValue,
} from './utils';

interface UseOpsWorkflowProps {
  orderId: string;
  initialOrder?: Partial<OrderOpsData> | null;
}

// MVP status flow: RECEIVED → PROCESSING → READY → IN_TRANSIT / INSTALLATION → COMPLETED.
const SCHEDULE_READY_STATUSES = new Set(['READY']);
const DELIVERY_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION', 'COMPLETED']);
const COMPLETED_STATUSES = new Set(['COMPLETED']);
const CANCELLED_STATUSES = new Set(['CANCELLED']);
const ACTIVE_DELIVERY_STATUSES = new Set(['IN_TRANSIT', 'INSTALLATION']);
const SCHEDULE_PHASE_STATUSES = new Set(['READY']);

export interface StatusChangeInput {
  targetStatus: OrderStatus;
  reason?: string;
  /** Admin only: skip unmet conditions, never the transition table. Requires a reason. */
  override?: boolean;
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { message?: unknown; error?: unknown };
  if (body.error && typeof body.error === 'object') {
    const message = (body.error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  if (typeof body.message === 'string' && body.message) return body.message;
  if (typeof body.error === 'string' && body.error) return body.error;
  return null;
}

function getOrderPhase(
  status: string | undefined,
  items: ReturnType<typeof normalizeOrderItems>
): OrderPhase {
  const s = String(status ?? '');
  if (COMPLETED_STATUSES.has(s)) return 'completed';
  if (CANCELLED_STATUSES.has(s)) return 'cancelled';
  if (ACTIVE_DELIVERY_STATUSES.has(s)) return 'delivery';
  if (SCHEDULE_PHASE_STATUSES.has(s)) return 'scheduling';

  // If all items are allocated, move to scheduling phase
  if (items.length > 0 && items.every((i) => i.allocationStatus === 'ALLOCATED')) {
    return 'scheduling';
  }

  return 'intake';
}

const DELIVERY_CHECKLIST_KEYS = [
  'delivery_address_verified',
  'delivery_customer_contacted',
  'delivery_items_loaded',
  'delivery_completed_on_site',
] as const;

function getPreferredActiveTab(
  orderData: OrderOpsData | undefined,
  items: ReturnType<typeof normalizeOrderItems>
): WorkflowTab {
  const serverFocus = getWorkflowFocus(orderData, items);
  if (serverFocus) {
    return serverFocus.tab;
  }

  if (orderData?.status && DELIVERY_STATUSES.has(String(orderData.status))) {
    return 'schedule';
  }

  if (orderData?.scheduledAt) return 'schedule';

  if (orderData?.status && SCHEDULE_READY_STATUSES.has(String(orderData.status))) {
    return 'schedule';
  }

  if (items.length > 0) {
    const decisions = buildIntakeDecisionsFromItems(items);
    const allItemsReady = items.every((item) => decisions[item.id] === 'STOCK');
    if (allItemsReady) {
      return 'schedule';
    }
  }

  return 'intake';
}

function getLocalWorkflowFocus(
  orderData: OrderOpsData | undefined,
  items: ReturnType<typeof normalizeOrderItems>
): WorkflowFocus {
  const preferredTab = (() => {
    if (orderData?.status && DELIVERY_STATUSES.has(String(orderData.status))) {
      return 'schedule';
    }

    if (orderData?.scheduledAt) {
      return 'schedule';
    }

    const decisions = buildIntakeDecisionsFromItems(items);
    const allItemsReady = items.length > 0 && items.every((item) => decisions[item.id] === 'STOCK');

    return allItemsReady ? 'schedule' : 'intake';
  })();

  if (preferredTab === 'schedule') {
    return {
      tab: 'schedule',
      title: orderData?.scheduledAt ? 'נדרש לעדכן או לאשר תיאום' : 'נדרש לקבוע מועד אספקה',
      description: orderData?.scheduledAt
        ? 'זה השלב התפעולי הפעיל כרגע להזמנה הזאת.'
        : 'כל מה שצריך עכשיו הוא לקבוע חלון זמן מתאים ללקוח.',
      primaryLabel: orderData?.scheduledAt ? 'עדכון תיאום' : 'תיאום משלוח',
      source: 'local',
      actionPanel: null,
      actionId: null,
    };
  }

  return {
    tab: 'intake',
    title: 'נדרשת בדיקת פריטים',
    description: 'השלב הבא הוא לאשר אילו פריטים זמינים ואילו עדיין ממתינים.',
    primaryLabel: 'בדיקת מלאי',
    source: 'local',
    actionPanel: null,
    actionId: null,
  };
}

function getWorkflowFocus(
  orderData: OrderOpsData | undefined,
  items: ReturnType<typeof normalizeOrderItems>
): WorkflowFocus | null {
  const primaryAction = orderData?.nextActions?.find((action) => action.isPrimary) ?? orderData?.nextActions?.[0];
  const modalName =
    primaryAction?.payload && typeof primaryAction.payload === 'object'
      ? String((primaryAction.payload as Record<string, unknown>).modal ?? '')
      : '';

  if (!primaryAction) {
    return null;
  }

  if (primaryAction.id === 'items_readiness' || modalName === 'ITEMS_AVAILABILITY') {
    return {
      tab: 'intake',
      title: 'נדרשת בדיקת זמינות פריטים',
      description:
        orderData?.workflowHints?.description ??
        'השרת סימן שהפעולה הנדרשת עכשיו היא לעדכן את מצב הפריטים בהזמנה.',
      primaryLabel: primaryAction.label,
      source: 'server',
      actionPanel: null,
      actionId: primaryAction.id,
    };
  }

  if (primaryAction.id === 'schedule_install' || modalName === 'SCHEDULE') {
    return {
      tab: 'schedule',
      title: 'נדרש תיאום מול הלקוח',
      description:
        orderData?.workflowHints?.description ??
        'השלב הבא לפי השרת הוא לקבוע חלון אספקה או התקנה.',
      primaryLabel: primaryAction.label,
      source: 'server',
      actionPanel: null,
      actionId: primaryAction.id,
    };
  }

  if (primaryAction.id === 'update_address' || modalName === 'ADDRESS') {
    return {
      tab: 'actions',
      title: 'נדרש להשלים כתובת לפני המשך',
      description:
        orderData?.workflowHints?.description ??
        'השרת זיהה שבלי כתובת תקינה אי אפשר להתקדם לשלב הבא.',
      primaryLabel: primaryAction.label,
      source: 'server',
      actionPanel: 'address',
      actionId: primaryAction.id,
    };
  }

  if (primaryAction.id === 'quick_payment' || modalName === 'PAYMENT') {
    return {
      tab: 'actions',
      title: 'נדרש טיפול תפעולי בהזמנה',
      description:
        orderData?.workflowHints?.description ??
        'השרת סימן פעולה ניהולית שדורשת תשומת לב לפני המשך התהליך.',
      primaryLabel: primaryAction.label,
      source: 'server',
      actionPanel: null,
      actionId: primaryAction.id,
    };
  }

  const fallbackTab = getPreferredActiveTab(
    {
      ...orderData,
      nextActions: [],
    } as OrderOpsData,
    items
  ) as WorkflowPrimaryTab;

  return {
    ...getLocalWorkflowFocus(orderData, items),
    tab: fallbackTab,
    primaryLabel: primaryAction.label,
    source: 'server',
    actionId: primaryAction.id,
  };
}

function extractDeliveryChecklistState(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const next: Record<string, boolean> = {};

  for (const key of DELIVERY_CHECKLIST_KEYS) {
    if (typeof record[key] === 'boolean') {
      next[key] = record[key] as boolean;
    }
  }

  return next;
}

function removeSyncedDecisionOverrides(
  overrides: Record<string, IntakeDecision>,
  baseDecisions: Record<string, IntakeDecision>,
  validItemIds: Set<string>
) {
  let changed = false;
  const next: Record<string, IntakeDecision> = {};

  for (const [itemId, decision] of Object.entries(overrides)) {
    if (!validItemIds.has(itemId)) {
      changed = true;
      continue;
    }

    if (baseDecisions[itemId] === decision) {
      changed = true;
      continue;
    }

    next[itemId] = decision;
  }

  return changed ? next : overrides;
}

export function useOpsWorkflow({ orderId, initialOrder }: UseOpsWorkflowProps) {
  const { toast } = useToast();
  const {
    data: order,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useOrderQuery(orderId, {
    refetchOnWindowFocus: false,
    placeholderData: initialOrder as any,
    refetchOnMount: 'always',
  });

  const orderData =
    (order as OrderOpsData | undefined) ?? (initialOrder as OrderOpsData | undefined);
  const { draftState, draftLoaded, saveDraft, clearDraft } = useOpsDraft(orderId);
  const { supplierOptions, suppliersLoading } = useSuppliers();

  // Basic UI State
  const [activeTab, setActiveTab] = useState<WorkflowTab>('intake');
  const [isProcessing, setIsProcessing] = useState(false);
  const initializedOrderIdRef = useRef<string | null>(null);

  // Form States
  const [intakeDecisionOverrides, setIntakeDecisionOverrides] = useState<
    Record<string, IntakeDecision>
  >({});
  const [poSelectedItemIds, setPoSelectedItemIds] = useState<string[]>([]);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poSupplierDetails, setPoSupplierDetails] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [supplierByItemId, setSupplierByItemId] = useState<Record<string, string>>({});
  const [receiveSelectedItemIds, setReceiveSelectedItemIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduleDateValue());
  const [scheduleWindow, setScheduleWindow] = useState<string>(getDefaultScheduleWindowValue());
  const [scheduleNotes, setScheduleNotes] = useState('');

  // ─── Draft Sync ───
  useEffect(() => {
    if (!draftLoaded || !draftState) return;
    if (draftState.intakeDecisions) {
      setIntakeDecisionOverrides(draftState.intakeDecisions as Record<string, IntakeDecision>);
    }
    if (draftState.poSelectedItemIds) setPoSelectedItemIds(draftState.poSelectedItemIds);
    if (draftState.poExpectedDate) setPoExpectedDate(draftState.poExpectedDate);
    if (draftState.poSupplierDetails) setPoSupplierDetails(draftState.poSupplierDetails);
    if (draftState.poNotes) setPoNotes(draftState.poNotes);
    if (draftState.supplierByItemId) setSupplierByItemId(draftState.supplierByItemId);
    if (draftState.scheduleNotes) setScheduleNotes(draftState.scheduleNotes);
    if (draftState.scheduledDate) setScheduledDate(draftState.scheduledDate);
    if (draftState.scheduleWindow) setScheduleWindow(draftState.scheduleWindow);
  }, [draftLoaded, draftState]);

  useEffect(() => {
    if (!draftLoaded) return;
    saveDraft({
      intakeDecisions: intakeDecisionOverrides,
      poSelectedItemIds,
      poExpectedDate,
      poSupplierDetails,
      poNotes,
      supplierByItemId,
      scheduleNotes,
      scheduledDate,
      scheduleWindow,
    });
  }, [
    draftLoaded,
    intakeDecisionOverrides,
    poSelectedItemIds,
    poExpectedDate,
    poSupplierDetails,
    poNotes,
    supplierByItemId,
    scheduleNotes,
    scheduledDate,
    scheduleWindow,
    saveDraft,
  ]);

  // ─── Derived Data ───
  const items = useMemo(() => normalizeOrderItems(orderData), [orderData]);
  const hasOrderData = Boolean(orderData);
  const workflowFocus = useMemo(
    () => getWorkflowFocus(orderData, items) ?? getLocalWorkflowFocus(orderData, items),
    [items, orderData]
  );

  // ─── Phase Logic ───
  const orderPhase = useMemo(
    () => getOrderPhase(orderData?.status as string | undefined, items),
    [orderData?.status, items]
  );
  const isIntakeLocked = orderPhase !== 'intake';
  const isScheduleLocked = orderPhase === 'completed' || orderPhase === 'cancelled';
  const isOrderCompleted = orderPhase === 'completed';
  const isOrderCancelled = orderPhase === 'cancelled';
  const baseIntakeDecisions = useMemo(() => buildIntakeDecisionsFromItems(items), [items]);
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const persistedScheduledAt = orderData?.scheduledAt ?? null;
  const persistedTimeWindowStart = orderData?.timeWindowStart ?? null;
  const persistedTimeWindowEnd = orderData?.timeWindowEnd ?? null;
  const persistedScheduleNotes = orderData?.notesToCrew ?? '';
  const deliveryChecklistState = useMemo(
    () => extractDeliveryChecklistState(orderData?.checklistState),
    [orderData?.checklistState]
  );
  const intakeDecisions = useMemo(
    () => ({
      ...baseIntakeDecisions,
      ...intakeDecisionOverrides,
    }),
    [baseIntakeDecisions, intakeDecisionOverrides]
  );
  const setIntakeDecisions: Dispatch<SetStateAction<Record<string, IntakeDecision>>> = useCallback(
    (value) => {
      setIntakeDecisionOverrides((previousOverrides) => {
        const currentResolved = {
          ...baseIntakeDecisions,
          ...previousOverrides,
        };
        const nextResolved = typeof value === 'function' ? value(currentResolved) : value;
        const nextOverrides: Record<string, IntakeDecision> = {};

        for (const [itemId, decision] of Object.entries(nextResolved)) {
          if (!itemIds.has(itemId)) continue;
          if (!decision) continue;
          if (baseIntakeDecisions[itemId] !== decision) {
            nextOverrides[itemId] = decision;
          }
        }

        return nextOverrides;
      });
    },
    [baseIntakeDecisions, itemIds]
  );

  // Sync from DB
  useEffect(() => {
    if (persistedScheduledAt) {
      setScheduledDate(toDateInputValue(new Date(persistedScheduledAt)));
      setScheduleWindow(
        deriveScheduleWindowValue(persistedTimeWindowStart, persistedTimeWindowEnd)
      );
    }
    if (persistedScheduleNotes) {
      setScheduleNotes(persistedScheduleNotes);
    }
  }, [
    persistedScheduledAt,
    persistedScheduleNotes,
    persistedTimeWindowEnd,
    persistedTimeWindowStart,
  ]);

  useEffect(() => {
    setIntakeDecisionOverrides((previous) =>
      removeSyncedDecisionOverrides(previous, baseIntakeDecisions, itemIds)
    );
  }, [baseIntakeDecisions, itemIds]);

  useEffect(() => {
    if (!hasOrderData || initializedOrderIdRef.current === orderId) return;
    initializedOrderIdRef.current = orderId;
    setActiveTab(workflowFocus.tab);
  }, [hasOrderData, items, orderData, orderId, workflowFocus.tab]);

  // Sync supplierByItemId from items
  useEffect(() => {
    setSupplierByItemId((previous) => {
      const next: Record<string, string> = { ...previous };
      for (const item of items) {
        if (item.supplierId) {
          next[item.id] = item.supplierId;
        }
      }
      return next;
    });
  }, [items]);

  const syncWorkflowFromServer = useCallback(
    async (autoSwitchTab = true) => {
      const refreshed = await refetch();
      const refreshedOrder = (refreshed.data as OrderOpsData | undefined) ?? orderData;
      if (autoSwitchTab && refreshedOrder) {
        const refreshedItems = normalizeOrderItems(refreshedOrder);
        setActiveTab((getWorkflowFocus(refreshedOrder, refreshedItems) ?? getLocalWorkflowFocus(refreshedOrder, refreshedItems)).tab);
      }
      return refreshedOrder;
    },
    [orderData, refetch]
  );

  // ─── Actions ───
  const updateItemsAllocationBatch = useCallback(
    async (updates: BatchAllocationUpdate[]) => {
      const orderVersionDate = orderData?.updatedAt ? new Date(orderData.updatedAt) : null;
      const orderVersionToken =
        orderVersionDate && !Number.isNaN(orderVersionDate.getTime())
          ? orderVersionDate.toISOString()
          : undefined;

      const response = await fetch(`/api/orders/${orderId}/items/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, expectedUpdatedAt: orderVersionToken }),
      });

      if (response.ok) return;

      await Promise.all(
        updates.map((update) =>
          fetch(`/api/orders/${orderId}/items/${update.itemId}/allocation`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: update.source, supplierId: update.supplierId }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed');
          })
        )
      );
    },
    [orderId, orderData?.updatedAt]
  );

  // The single client path for status changes. The server enforces the transition table and
  // its conditions; a held order resumes through /unhold to the step it was held from.
  const changeOrderStatus = useCallback(
    async ({ targetStatus, reason, override = false }: StatusChangeInput) => {
      const resume = orderData?.status === 'ON_HOLD' && targetStatus !== 'CANCELLED' && !override;
      const request = override
        ? { url: `/api/orders/${orderId}/override-status`, body: { toStatus: targetStatus, reason } }
        : resume
          ? { url: `/api/orders/${orderId}/unhold`, body: {} }
          : { url: `/api/orders/${orderId}/status`, body: { status: targetStatus, reason: reason || undefined } };

      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(readErrorMessage(payload) ?? 'שגיאה בעדכון סטטוס');
      }
      return syncWorkflowFromServer();
    },
    [orderData?.status, orderId, syncWorkflowFromServer]
  );

  const saveIntake = async () => {
    const entries = Object.entries(intakeDecisions).filter(([, d]) => Boolean(d));
    if (entries.length === 0) {
      toast({ title: 'בחר לפחות פריט אחד', variant: 'destructive' });
      return;
    }

    const changedEntries = entries.filter(
      ([itemId, decision]) => baseIntakeDecisions[itemId] !== decision
    );
    const allItemsReady =
      items.length > 0 && items.every((item) => intakeDecisions[item.id] === 'STOCK');

    if (changedEntries.length === 0) {
      if (orderData?.status === 'RECEIVED') {
        try {
          await changeOrderStatus({ targetStatus: 'PROCESSING', reason: 'קליטת הזמנה' });
        } catch (statusError) {
          toast({
            title: 'ההזמנה לא עברה ל"בטיפול"',
            description: statusError instanceof Error ? statusError.message : undefined,
            variant: 'destructive',
          });
          return;
        }
      }
      setActiveTab(allItemsReady ? 'schedule' : 'intake');
      toast({
        title: 'מצב הפריטים כבר מעודכן',
        description: allItemsReady
          ? 'אפשר לעבור עכשיו לקביעת מועד אספקה.'
          : 'לא זוהו שינויים חדשים לשמירה.',
        variant: 'default',
      });
      return;
    }

    const stockIds = changedEntries.filter(([, d]) => d === 'STOCK').map(([id]) => id);
    const poIds = changedEntries.filter(([, d]) => d === 'PO').map(([id]) => id);

    setIsProcessing(true);
    try {
      await updateItemsAllocationBatch([
        ...stockIds.map((id) => ({ itemId: id, source: 'STOCK' as const })),
        ...poIds.map((id) => ({ itemId: id, source: 'SUPPLIER' as const })),
      ]);
      // Taking the order in is when handling starts.
      if (orderData?.status === 'RECEIVED') {
        try {
          await changeOrderStatus({ targetStatus: 'PROCESSING', reason: 'קליטת הזמנה' });
        } catch (statusError) {
          toast({
            title: 'הפריטים נשמרו, אבל ההזמנה לא עברה ל"בטיפול"',
            description: statusError instanceof Error ? statusError.message : undefined,
            variant: 'destructive',
          });
        }
      }
      // Refresh data without auto-switching tabs — we handle tab logic below
      const refreshedOrder = await syncWorkflowFromServer(false);
      setIntakeDecisionOverrides({});

      toast({
        title: 'קליטת הזמנה נשמרה',
        description: poIds.length > 0 ? 'מצב הפריטים עודכן ונשמר בהזמנה.' : 'כל הפריטים זמינים.',
        variant: 'default',
      });

      if (poIds.length > 0) {
        setPoSelectedItemIds(poIds);
        setActiveTab('intake');
      } else {
        // All items ready or mixed — navigate to the best next tab
        setActiveTab(
          getPreferredActiveTab(
            refreshedOrder ?? orderData,
            normalizeOrderItems(refreshedOrder ?? orderData)
          )
        );
      }
    } catch {
      toast({ title: 'שגיאה בקליטת הזמנה', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveSchedule = async () => {
    if (isScheduleLocked) {
      toast({
        title: 'לא ניתן לעדכן תיאום',
        description: 'הזמנה שהושלמה או בוטלה אינה ניתנת לשינוי.',
        variant: 'destructive',
      });
      return;
    }

    const schedulePayload = buildScheduleWindowPayload(scheduledDate, scheduleWindow);

    if (!scheduledDate || !schedulePayload) {
      toast({ title: 'בחר מועד', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      const address = buildScheduleAddressPayload(orderData);

      const response = await fetch(`/api/orders/${orderId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: schedulePayload.scheduledAtIso,
          scheduledEnd: schedulePayload.scheduledEndIso,
          scheduleMode: 'TIME_WINDOW',
          timeWindowStart: schedulePayload.timeWindowStart,
          timeWindowEnd: schedulePayload.timeWindowEnd,
          expectedUpdatedAt: orderData?.updatedAt,
          notesToCrew: scheduleNotes || undefined,
          address,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.detail?.message ||
            payload?.error?.message ||
            payload?.error ||
            payload?.message ||
            'Failed'
        );
      }

      const result = await response.json();
      const autoRebalanced = result?.data?.autoRebalanced;
      const refreshedOrder = await syncWorkflowFromServer(false);
      clearDraft();
      setActiveTab(
        getPreferredActiveTab(
          refreshedOrder ?? orderData,
          normalizeOrderItems(refreshedOrder ?? orderData)
        )
      );

      toast({ title: 'תיאום משלוח נשמר', variant: 'default' });

      if (autoRebalanced?.count) {
        toast({
          title: 'המסלול עודכן אוטומטית',
          description: `${autoRebalanced.count} משלוחים רחוקים יותר הועברו ליום הבא כדי לשמור על מסלול ישים.`,
          variant: 'default',
        });
      }

    } catch (error) {
      toast({
        title: 'שגיאה בתיאום',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const setSupplierForItem = (itemId: string, supplierId: string) => {
    setSupplierByItemId((prev) => {
      const next = { ...prev };
      if (supplierId) next[itemId] = supplierId;
      else delete next[itemId];
      return next;
    });
  };

  const toggleDeliveryChecklistItem = useCallback(
    async (itemId: string, checked: boolean) => {
      try {
        const response = await fetch(`/api/orders/${orderId}/checklist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, isChecked: checked }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error?.message || payload?.message || 'שגיאה בעדכון checklist');
        }

        await syncWorkflowFromServer();
      } catch (error) {
        toast({
          title: 'שגיאה בעדכון רשימת ביצוע',
          description: error instanceof Error ? error.message : undefined,
          variant: 'destructive',
        });
      }
    },
    [orderId, syncWorkflowFromServer, toast]
  );

  const saveIssueNote = async (itemName: string, issueDescription: string) => {
    setIsProcessing(true);
    try {
      await changeOrderStatus({
        targetStatus: 'ON_HOLD',
        reason: `בעיה בפריט "${itemName}": ${issueDescription}`,
      });
      toast({ title: 'הבעיה תועדה וההזמנה הושהתה', variant: 'default' });
    } catch (error) {
      await refetch();
      toast({
        title: 'לא ניתן להשהות את ההזמנה',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    orderData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    activeTab,
    setActiveTab,
    isProcessing,
    orderPhase,
    isIntakeLocked,
    isScheduleLocked,
    isOrderCompleted,
    isOrderCancelled,
    intakeDecisions,
    setIntakeDecisions,
    saveIntake,
    changeOrderStatus,
    poSelectedItemIds,
    setPoSelectedItemIds,
    poExpectedDate,
    setPoExpectedDate,
    poSupplierDetails,
    setPoSupplierDetails,
    poNotes,
    setPoNotes,
    supplierOptions,
    suppliersLoading,
    supplierByItemId,
    setSupplierForItem,
    receiveSelectedItemIds,
    setReceiveSelectedItemIds,
    scheduledDate,
    setScheduledDate,
    scheduleWindow,
    setScheduleWindow,
    scheduleNotes,
    setScheduleNotes,
    saveSchedule,
    deliveryChecklistState,
    toggleDeliveryChecklistItem,
    items,
    saveIssueNote,
    workflowFocus,
  };
}
