import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '@/src/server/domain/orders/OrdersService';
import { OrdersRepository } from '@/lib/repositories/orders/OrdersRepository';
import { CustomersRepository } from '@/lib/repositories/customers/CustomersRepository';
import { ProductsRepository } from '@/lib/repositories/products/ProductsRepository';
import { createCacheService } from '@/lib/cache/CacheService';
import { logger } from '@/lib/logger';
import { AuditService } from '@/lib/services/audit/AuditService';
import { PaymentsService } from '@/lib/services/payments/PaymentsService';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import type { ActionDefinition } from '@/lib/assistant/actionRegistry';
import type { NextSuggestion } from '@/lib/assistant/uiPayloadSchema';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import { auditOrderStatusChange } from '@/lib/audit';

const setStatusSchema = z.object({
  orderId: z.string().min(3),
  newStatus: z.enum([
    'TO_DO',
    'CALL_BACK',
    'PO_CREATED',
    'AWAITING_STOCK',
    'PARTIALLY_SUPPLIED',
    'READY_FOR_INSTALL',
    'SCHEDULED',
    'COMPLETED',
  ]),
  reason: z.string().optional(),
});

let ordersService: OrdersService | null = null;
function getOrdersService(): OrdersService {
  if (ordersService) return ordersService;

  const cache = createCacheService();
  const ordersRepo = new OrdersRepository(cache, logger);
  const customersRepo = new CustomersRepository(cache, logger);
  const productsRepo = new ProductsRepository(cache, logger);
  const auditService = new AuditService();
  const paymentsService = new PaymentsService(logger, auditService);

  ordersService = new OrdersService(
    ordersRepo,
    customersRepo,
    productsRepo,
    logger,
    auditService,
    paymentsService
  );
  return ordersService;
}

const setStatusAction: ActionDefinition<typeof setStatusSchema> = {
  id: 'orders.set_status',
  paramsSchema: setStatusSchema,
  handler: async (params, ctx) => {
    const service = getOrdersService();
    const normalizedStatus = normalizeOrderStatus(params.newStatus) as OrderStatus;

    const updated = await service.changeOrderStatus(
      params.orderId,
      {
        newStatus: normalizedStatus,
        reason: params.reason,
      },
      ctx.user.id
    );

    await auditOrderStatusChange({
      orderId: params.orderId,
      fromStatus: updated.status,
      toStatus: normalizedStatus,
      actorId: ctx.user.id,
      reason: params.reason,
    });

    const suggestions: NextSuggestion[] = [
      {
        id: 'calendar.sync_installation_event',
        label: 'קבע ביומן התקנה',
        paramsHint: { orderId: params.orderId },
      },
      DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.status_dashboard')!,
    ].filter(Boolean) as NextSuggestion[];

    return {
      title: 'סטטוס עודכן בהצלחה',
      view: 'order_detail',
      blocks: [
        {
          type: 'cards',
          items: [
            {
              title: `הזמנה #${updated.number}`,
              subtitle: updated.customer?.name ?? 'לא ידוע',
              value: getStatusLabel(normalizedStatus),
              badge: params.reason,
              meta: {
                total: updated.total,
              },
            },
          ],
        },
        {
          type: 'text',
          content: `הסטטוס עודכן ל-${getStatusLabel(normalizedStatus)}`,
          tone: 'success',
        },
      ],
      nextSuggestions: suggestions,
      statePatch: {
        lastActionId: 'orders.set_status',
        selectedOrderIds: [params.orderId],
        lastFilters: { status: normalizedStatus },
      },
    };
  },
};

export const orderActions: Record<string, ActionDefinition<any>> = {
  [setStatusAction.id]: setStatusAction,
};
