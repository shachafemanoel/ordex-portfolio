import type { OpsQueuesResponse } from '@/src/server/dto/ops.dto';

/** Fetch shipments queue data. */
export async function getShipmentsQueues(): Promise<OpsQueuesResponse> {
  const res = await fetch('/api/v1/ops/queues?scope=shipments');
  if (!res.ok) {
    throw new Error(`Failed to fetch shipments queues: ${res.status}`);
  }

  const json = await res.json();
  return json.data ?? json;
}
