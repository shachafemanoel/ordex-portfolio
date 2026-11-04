'use client';

import { getOpsQueues } from '@/src/features/ops/api/ops.api';
import type { OpsQueue, OpsTab } from '@/src/server/dto/ops.dto';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';

const LS_KEY = 'ordex:ops:activeTab';
const VALID_TABS: OpsTab[] = ['active', 'new', 'future'];

function readSavedTab(): OpsTab {
  if (typeof window === 'undefined') return 'active';
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && VALID_TABS.includes(saved as OpsTab)) return saved as OpsTab;
  } catch {
    // localStorage unavailable
  }
  return 'active';
}

export interface OrdersOpsInsights {
  urgentCount: number;
  actionableCount: number;
  contactableCount: number;
}

export function useOrdersOpsBoard() {
  const [activeTab, setActiveTab] = useState<OpsTab>(readSavedTab);

  const setActiveTabPersisted = (tab: OpsTab) => {
    setActiveTab(tab);
    try { localStorage.setItem(LS_KEY, tab); } catch { /* ignore */ }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());

  const query = useQuery({
    queryKey: ['ops-queues', 'orders', activeTab],
    queryFn: () => getOpsQueues({ scope: 'orders', tab: activeTab }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const filteredQueues = useMemo<OpsQueue[]>(() => {
    if (!query.data?.queues) return [];
    if (!deferredSearch) return query.data.queues;

    return query.data.queues
      .map((queue): OpsQueue | null => {
        const allItems = queue.top ? [queue.top, ...queue.rest] : queue.rest;
        const matched = allItems.filter(
          (item) =>
            item.customerName?.toLowerCase().includes(deferredSearch) ||
            item.summary.toLowerCase().includes(deferredSearch) ||
            item.addressLine?.toLowerCase().includes(deferredSearch) ||
            item.customerPhone?.toLowerCase().includes(deferredSearch) ||
            item.itemsSummary?.toLowerCase().includes(deferredSearch) ||
            item.itemLabels?.some((label) => label.toLowerCase().includes(deferredSearch))
        );

        if (matched.length === 0) return null;

        const [newTop, ...newRest] = matched;
        return { ...queue, top: newTop ?? null, rest: newRest, count: matched.length };
      })
      .filter((queue): queue is OpsQueue => queue !== null);
  }, [deferredSearch, query.data?.queues]);

  const totalCount = useMemo(
    () => query.data?.queues.reduce((sum, queue) => sum + queue.count, 0) ?? 0,
    [query.data?.queues]
  );

  const insights = useMemo<OrdersOpsInsights>(() => {
    const items =
      query.data?.queues.flatMap((queue) => (queue.top ? [queue.top, ...queue.rest] : queue.rest)) ??
      [];

    return {
      urgentCount: items.filter((item) => item.isUrgent).length,
      actionableCount: items.filter((item) => item.derivedTask.isActionableNow).length,
      contactableCount: items.filter((item) => Boolean(item.customerPhone?.trim())).length,
    };
  }, [query.data?.queues]);

  return {
    activeTab,
    setActiveTab: setActiveTabPersisted,
    searchQuery,
    setSearchQuery,
    selectedOrderId,
    setSelectedOrderId,
    filteredQueues,
    totalCount,
    insights,
    clearSearch: () => setSearchQuery(''),
    isBusy: query.isLoading || query.isFetching,
    ...query,
  };
}
