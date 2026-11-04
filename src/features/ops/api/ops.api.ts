import type { OpsQueuesResponse, OpsScope, OpsTab } from '@/src/server/dto/ops.dto';

interface GetOpsQueuesParams {
  scope: OpsScope;
  tab?: OpsTab;
}

/** Fetch queue data from the ops endpoint. */
export async function getOpsQueues(params: GetOpsQueuesParams): Promise<OpsQueuesResponse> {
  const sp = new URLSearchParams({ scope: params.scope });
  if (params.tab) sp.set('tab', params.tab);

  const res = await fetch(`/api/v1/ops/queues?${sp.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ops queues: ${res.status}`);
  }

  const json = await res.json();
  // The endpoint wraps in { success, data }
  return json.data ?? json;
}
