import { getRedisClient } from '@/lib/redis';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

export const OPS_REALTIME_CHANNEL = 'ordex:ops:events';

export type OpsRealtimeScope = 'orders' | 'today' | 'deliveries' | 'all';

export interface OpsRealtimeEvent {
  id: string;
  at: string;
  type: 'order.updated' | 'timeline.updated' | 'ops.reminder';
  scopes: OpsRealtimeScope[];
  orderId?: string;
  payload?: Record<string, unknown>;
}

type RealtimeListener = (event: OpsRealtimeEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function subscribeOpsRealtime(listener: RealtimeListener): () => void {
  emitter.on('ops-event', listener);
  return () => emitter.off('ops-event', listener);
}

export function shouldDeliverEvent(
  event: OpsRealtimeEvent,
  requestedScopes: OpsRealtimeScope[]
): boolean {
  if (requestedScopes.length === 0) return true;
  if (requestedScopes.includes('all')) return true;
  if (event.scopes.includes('all')) return true;
  return event.scopes.some((scope) => requestedScopes.includes(scope));
}

export function parseRealtimeEventMessage(message: string): OpsRealtimeEvent | null {
  try {
    const parsed = JSON.parse(message) as Partial<OpsRealtimeEvent>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.id !== 'string') return null;
    if (typeof parsed.at !== 'string') return null;
    if (typeof parsed.type !== 'string') return null;
    if (!Array.isArray(parsed.scopes)) return null;

    return {
      id: parsed.id,
      at: parsed.at,
      type: parsed.type as OpsRealtimeEvent['type'],
      scopes: parsed.scopes as OpsRealtimeScope[],
      orderId: typeof parsed.orderId === 'string' ? parsed.orderId : undefined,
      payload: parsed.payload && typeof parsed.payload === 'object'
        ? (parsed.payload as Record<string, unknown>)
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function publishOpsRealtimeEvent(
  event: Omit<OpsRealtimeEvent, 'id' | 'at'> & { id?: string; at?: string }
): Promise<OpsRealtimeEvent> {
  const normalized: OpsRealtimeEvent = {
    id: event.id ?? randomUUID(),
    at: event.at ?? new Date().toISOString(),
    type: event.type,
    scopes: event.scopes.length > 0 ? event.scopes : ['all'],
    orderId: event.orderId,
    payload: event.payload,
  };

  emitter.emit('ops-event', normalized);

  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.publish(OPS_REALTIME_CHANNEL, JSON.stringify(normalized));
    }
  } catch (error) {
    console.warn('[ops-realtime] Failed to publish Redis event', error);
  }

  return normalized;
}
