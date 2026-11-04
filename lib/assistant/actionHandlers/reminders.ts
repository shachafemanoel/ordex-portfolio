import { z } from 'zod';
import { zonedTimeToUtc } from 'date-fns-tz';
import { prisma } from '@/lib/db';
import { sendBulkSms } from '@/lib/messaging';
import type { ActionDefinition } from '@/lib/assistant/actionRegistry';
import type { NextSuggestion } from '@/lib/assistant/uiPayloadSchema';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import { logAudit } from '@/lib/audit';

const reminderSchema = z.object({
  date: z.string().optional(),
  orderIds: z.array(z.string()).optional(),
});

function resolveTargetDate(input?: string): string {
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  if (!input) return tomorrow();

  const normalized = input.trim().toLowerCase();
  if (normalized === 'tomorrow' || normalized === 'מחר') {
    return tomorrow();
  }

  if (normalized === 'today' || normalized === 'היום') {
    return new Date().toISOString().slice(0, 10);
  }

  const asDate = new Date(normalized);
  if (Number.isNaN(asDate.getTime())) {
    return tomorrow();
  }

  return asDate.toISOString().slice(0, 10);
}

const sendRemindersAction: ActionDefinition<typeof reminderSchema> = {
  id: 'reminders.send_day_before',
  paramsSchema: reminderSchema,
  handler: async (params, ctx) => {
    const timeZone = 'Asia/Jerusalem';
    const targetDate = resolveTargetDate(params.date);

    const from = zonedTimeToUtc(`${targetDate} 00:00:00`, timeZone);
    const to = zonedTimeToUtc(`${targetDate} 23:59:59.999`, timeZone);

    const orders = await prisma.order.findMany({
      where: {
        ...(params.orderIds?.length ? { id: { in: params.orderIds } } : {}),
        scheduledAt: { gte: from, lte: to },
        customerPhone: { not: null },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        scheduledAt: true,
        city: true,
      },
    });

    const messages = orders
      .filter((order) => order.customerPhone)
      .map((order) => ({
        to: order.customerPhone!,
        body: `תזכורת: התקנה להזמנה ${order.number} ב-${order.city ?? ''} בתאריך ${
          order.scheduledAt?.toLocaleDateString('he-IL') ?? targetDate
        }.`,
      }));

    const results = await sendBulkSms(messages, 200);

    if (orders.length > 0) {
      await logAudit({
        actorId: ctx.user.id,
        action: 'CREATE',
        entity: 'MessageLog',
        entityId: orders[0].id,
        after: { processed: orders.length, sent: results.sent, failed: results.failed },
      });
    }

    const nextSuggestions: NextSuggestion[] = [
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.pending_installations')!,
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.status_dashboard')!,
    ].filter(Boolean) as NextSuggestion[];

    return {
      title: 'שליחת תזכורות',
      view: 'toast_only',
      blocks: [
        {
          type: 'text',
          content: `נשלחו ${results.sent} תזכורות, נכשלו ${results.failed}`,
          tone: results.failed > 0 ? 'warn' : 'success',
        },
      ],
      nextSuggestions,
      statePatch: {
        lastActionId: 'reminders.send_day_before',
        lastFilters: { date: targetDate },
        selectedOrderIds: orders.map((o) => o.id),
      },
    };
  },
};

export const reminderActions: Record<string, ActionDefinition<any>> = {
  [sendRemindersAction.id]: sendRemindersAction,
};
