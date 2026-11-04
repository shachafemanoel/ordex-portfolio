import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInstallationEvent } from '@/lib/calendar';
import type { ActionDefinition } from '@/lib/assistant/actionRegistry';
import type { NextSuggestion } from '@/lib/assistant/uiPayloadSchema';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import { logAudit } from '@/lib/audit';

const calendarSchema = z.object({
  orderId: z.string().min(3),
  notes: z.string().optional(),
});

const syncInstallationEventAction: ActionDefinition<typeof calendarSchema> = {
  id: 'calendar.sync_installation_event',
  paramsSchema: calendarSchema,
  handler: async (params, ctx) => {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        number: true,
        customerName: true,
        city: true,
        addressLine: true,
        notes: true,
        scheduledAt: true,
      },
    });

    if (!order) {
      return {
        title: 'התקנה ביומן',
        view: 'toast_only',
        blocks: [
          { type: 'text', content: 'ההזמנה לא נמצאה', tone: 'warn' },
        ],
        nextSuggestions: DEFAULT_ACTION_SUGGESTIONS,
        statePatch: { lastActionId: 'calendar.sync_installation_event' },
      };
    }

    const scheduledAt = order.scheduledAt ?? new Date();
    const address = [order.addressLine, order.city].filter(Boolean).join(', ');

    const result = await createInstallationEvent({
      id: order.id,
      number: order.number,
      customerName: order.customerName ?? 'לקוח',
      note: params.notes ?? order.notes ?? undefined,
      address: address || 'ללא כתובת',
      city: order.city ?? undefined,
      installAt: scheduledAt,
    });

    if (result.success) {
      await logAudit({
        actorId: ctx.user.id,
        action: 'CREATE',
        entity: 'CalendarEvent',
        entityId: order.id,
        after: { scheduledAt, orderId: order.id },
      });
    }

    const nextSuggestions: NextSuggestion[] = [
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reminders.send_day_before')!,
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.status_dashboard')!,
    ].filter(Boolean) as NextSuggestion[];

    return {
      title: 'התקנה ביומן',
      view: 'calendar',
      blocks: [
        {
          type: 'text',
          content: result.success
            ? `האירוע נשמר ביומן עבור הזמנה #${order.number}`
            : `נכשל בסנכרון היומן: ${result.error ?? 'לא ידוע'}`,
          tone: result.success ? 'success' : 'warn',
        },
      ],
      nextSuggestions,
      statePatch: {
        lastActionId: 'calendar.sync_installation_event',
        selectedOrderIds: [order.id],
      },
    };
  },
};

export const calendarActions: Record<string, ActionDefinition<any>> = {
  [syncInstallationEventAction.id]: syncInstallationEventAction,
};
