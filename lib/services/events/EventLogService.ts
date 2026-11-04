import { prisma } from '@/lib/db';

export interface EventLogItem {
  id: string;
  title: string;
  timestamp: Date;
  type: 'CALENDAR' | 'ORDER_STATUS' | 'GENERIC';
  status?: string | null;
}

export class EventLogService {
  async fetchEvents(options: { limit?: number } = {}): Promise<{ items: EventLogItem[] }> {
    const limit = options.limit ?? 30;

    try {
      const auditEvents = await (prisma as any).auditEvent?.findMany?.({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      if (!Array.isArray(auditEvents)) {
        return { items: [] };
      }

      return {
        items: auditEvents.map((event: any) => ({
          id: String(event.id),
          title: String(event.action ?? event.type ?? 'אירוע מערכת'),
          timestamp: new Date(event.createdAt ?? Date.now()),
          type: String(event.action ?? '').includes('STATUS') ? 'ORDER_STATUS' : 'GENERIC',
          status: event.payload?.toStatus ?? null,
        })),
      };
    } catch {
      return { items: [] };
    }
  }
}
