'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OpsTabs } from '@/src/features/ops/ui/OpsTabs';
import { OpsQueueList } from '@/src/features/ops/ui/OpsQueueList';
import { OpsSkeletonLoader } from '@/src/features/ops/ui/OpsSkeletonLoader';
import { getOpsQueues } from '@/src/features/ops/api/ops.api';
import type { OpsTab, OpsScope, OpsQueuesResponse } from '@/src/server/dto/ops.dto';

const POLL_INTERVAL_MS = 30_000;

const SCOPES: { key: OpsScope; label: string }[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'shipments', label: 'Shipments' },
];

interface OpsPageProps {
  /** Called when the user selects an order (e.g. to navigate to order detail). */
  onOrderSelect?: (orderId: string) => void;
}

/** Orders / Shipments Ops daily board — queue-based with scope + tab switchers. */
export function OpsPage({ onOrderSelect }: OpsPageProps) {
  const [scope, setScope] = useState<OpsScope>('orders');
  const [tab, setTab] = useState<OpsTab>('new');
  const [data, setData] = useState<OpsQueuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track counts for badge display on both tabs
  const [newCount, setNewCount] = useState<number | undefined>();
  const [futureCount, setFutureCount] = useState<number | undefined>();

  // Elapsed seconds since last update
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueues = useCallback(
    async (activeTab: OpsTab, activeScope: OpsScope, opts: { silent?: boolean } = {}) => {
      if (opts.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await getOpsQueues({ scope: activeScope, tab: activeTab });
        setData(result);
        setLastUpdated(new Date());
        setElapsedSec(0);

        const totalCount = result.queues.reduce((sum, q) => sum + q.count, 0);
        if (activeTab === 'new') setNewCount(totalCount);
        else setFutureCount(totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load queues');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  // Fetch active tab data whenever tab or scope changes
  useEffect(() => {
    setNewCount(undefined);
    setFutureCount(undefined);
    setData(null);
    fetchQueues(tab, scope);
  }, [tab, scope, fetchQueues]);

  // Pre-fetch the other tab's count so the badge shows immediately
  useEffect(() => {
    const otherTab: OpsTab = tab === 'new' ? 'future' : 'new';
    getOpsQueues({ scope, tab: otherTab })
      .then((res) => {
        const total = res.queues.reduce((sum, q) => sum + q.count, 0);
        if (otherTab === 'future') setFutureCount(total);
        else setNewCount(total);
      })
      .catch(() => {/* non-critical */});
  }, [tab, scope]);

  // Auto-refresh polling
  useEffect(() => {
    const id = setInterval(() => {
      fetchQueues(tab, scope, { silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tab, scope, fetchQueues]);

  // Elapsed-seconds counter
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleManualRefresh = () => {
    fetchQueues(tab, scope, { silent: true });
  };

  const handleScopeChange = (newScope: OpsScope) => {
    setScope(newScope);
    setTab('new');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Ops Board</h1>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 tabular-nums">
              Updated {elapsedSec < 5 ? 'just now' : `${elapsedSec}s ago`}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshIcon spinning={refreshing} />
            Refresh
          </button>
        </div>
      </div>

      {/* Scope switcher */}
      <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 self-start">
        {SCOPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleScopeChange(key)}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              scope === key
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <OpsTabs
        activeTab={tab}
        onTabChange={setTab}
        newCount={newCount}
        futureCount={futureCount}
      />

      {/* Loading skeleton */}
      {loading && <OpsSkeletonLoader />}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => fetchQueues(tab, scope)}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Queue list */}
      {!loading && !error && data && (
        <div className="relative">
          {refreshing && (
            <div className="absolute inset-0 bg-white/60 z-10 rounded-lg" />
          )}
          <OpsQueueList queues={data.queues} onItemClick={onOrderSelect} />
        </div>
      )}
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
