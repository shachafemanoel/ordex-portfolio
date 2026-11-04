'use client';

import { useState, useEffect } from 'react';
import { ShipmentsQueueList } from '@/src/features/shipments/ui/ShipmentsQueueList';
import { getShipmentsQueues } from '@/src/features/shipments/api/shipments.api';
import type { OpsQueuesResponse } from '@/src/server/dto/ops.dto';

interface ShipmentsPageProps {
  onOrderSelect?: (orderId: string) => void;
}

/** Shipments Ops daily board — queue-based view. */
export function ShipmentsPage({ onOrderSelect }: ShipmentsPageProps) {
  const [data, setData] = useState<OpsQueuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getShipmentsQueues();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load shipments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Shipments Ops</h1>

      {loading && (
        <div className="text-center py-8 text-sm text-gray-400">Loading...</div>
      )}

      {error && (
        <div className="text-center py-8 text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && data && (
        <ShipmentsQueueList queues={data.queues} onItemClick={onOrderSelect} />
      )}
    </div>
  );
}
