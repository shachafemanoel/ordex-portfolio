'use client';

import { OpsRealtimeScope } from '@/lib/ops/realtime';
import { useEffect, useMemo, useRef } from 'react';

export interface UseOpsRealtimeEvent {
  id?: string;
  at?: string;
  type: 'order.updated' | 'timeline.updated' | 'ops.reminder' | string;
  scopes?: OpsRealtimeScope[];
  orderId?: string;
  payload?: Record<string, unknown>;
}

interface UseOpsRealtimeOptions {
  scopes?: OpsRealtimeScope[];
  orderId?: string;
  enabled?: boolean;
  throttleMs?: number;
  onEvent: (event: UseOpsRealtimeEvent) => void;
}

function parseEventPayload(message: MessageEvent): UseOpsRealtimeEvent | null {
  try {
    const parsed = JSON.parse(message.data) as Partial<UseOpsRealtimeEvent>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : undefined,
      at: typeof parsed.at === 'string' ? parsed.at : undefined,
      type: typeof parsed.type === 'string' ? parsed.type : 'unknown',
      scopes: Array.isArray(parsed.scopes)
        ? (parsed.scopes.filter((scope) => typeof scope === 'string') as OpsRealtimeScope[])
        : undefined,
      orderId: typeof parsed.orderId === 'string' ? parsed.orderId : undefined,
      payload:
        parsed.payload && typeof parsed.payload === 'object'
          ? (parsed.payload as Record<string, unknown>)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function useOpsRealtime(options: UseOpsRealtimeOptions): void {
  const {
    scopes = ['orders'],
    orderId,
    enabled = true,
    throttleMs = 800,
    onEvent,
  } = options;
  const onEventRef = useRef(onEvent);
  const lastEmitAtRef = useRef(0);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    for (const scope of scopes) {
      params.append('scope', scope);
    }
    if (orderId) {
      params.set('orderId', orderId);
    }
    return `/api/ops/realtime?${params.toString()}`;
  }, [orderId, scopes]);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(url);

    const handleEvent = (message: MessageEvent) => {
      const event = parseEventPayload(message);
      if (!event) return;

      const now = Date.now();
      if (throttleMs > 0 && now - lastEmitAtRef.current < throttleMs) {
        return;
      }
      lastEmitAtRef.current = now;
      onEventRef.current(event);
    };

    source.addEventListener('order.updated', handleEvent);
    source.addEventListener('timeline.updated', handleEvent);
    source.addEventListener('ops.reminder', handleEvent);

    return () => {
      source.removeEventListener('order.updated', handleEvent);
      source.removeEventListener('timeline.updated', handleEvent);
      source.removeEventListener('ops.reminder', handleEvent);
      source.close();
    };
  }, [enabled, throttleMs, url]);
}
