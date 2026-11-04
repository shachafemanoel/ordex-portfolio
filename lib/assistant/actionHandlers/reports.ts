import { ordersRepo } from '@/lib/data/ordersRepo';
import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { z } from 'zod'; // Import z from zod
import type { ActionContext, ActionDefinition } from '@/lib/assistant/actionRegistry';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import type { NextSuggestion, UIPayload } from '@/lib/assistant/uiPayloadSchema';

const baseFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  city: z.string().optional(),
  status: z.array(z.string()).optional(),
});

const historicalSchema = baseFilterSchema.extend({
  months: z.number().int().positive().max(24).optional(),
});

const STATUS_ORDER: Array<{ key: string; label: string }> = [
  { key: 'TO_DO', label: getStatusLabel('TO_DO') },
  { key: 'CALL_BACK', label: getStatusLabel('CALL_BACK') },
  { key: 'PO_CREATED', label: getStatusLabel('PO_CREATED') },
  { key: 'AWAITING_STOCK', label: getStatusLabel('AWAITING_STOCK') },
  { key: 'PARTIALLY_SUPPLIED', label: getStatusLabel('PARTIALLY_SUPPLIED') },
  { key: 'READY_FOR_INSTALL', label: getStatusLabel('READY_FOR_INSTALL') },
  { key: 'SCHEDULED', label: getStatusLabel('SCHEDULED') },
  { key: 'COMPLETED', label: getStatusLabel('COMPLETED') },
];

function summarizeWithGemini(
  payload: UIPayload,
  _ctx: ActionContext
): { blocks: UIPayload['blocks']; next: NextSuggestion[]; cacheId: null } {
  return { blocks: payload.blocks, next: [], cacheId: null };
}

const statusDashboardAction: ActionDefinition<typeof baseFilterSchema> = {
  id: 'reports.status_dashboard',
  paramsSchema: baseFilterSchema,
  handler: async (params, ctx) => {
    // Use lib/data/ordersRepo for cached, optimized queries
    const filters = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      city: params.city,
      status: params.status,
    };

    // Get aggregated status counts and order details from cached repo
    const [statusBreakdown, recentOrders] = await Promise.all([
      ordersRepo.getStatusBreakdown(filters),
      ordersRepo.list({
        ...filters,
        limit: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    ]);

    const groups = statusBreakdown;
    const drilldown = recentOrders;

    const kpiItems = STATUS_ORDER.map((status) => {
      const match = groups.find((g) => normalizeOrderStatus(g.status) === status.key);
      return {
        label: status.label,
        value: match?._count.id ?? 0,
        helper:
          typeof match?._sum.totalCents === 'number'
            ? `₪${(match!._sum.totalCents! / 100).toLocaleString('he-IL')}`
            : undefined,
      };
    });

    const rows = drilldown.map((order) => {
      const normalized = normalizeOrderStatus(order.status);
      return {
        id: order.id,
        number: order.number,
        customer: order.customerName ?? 'לא ידוע',
        status: getStatusLabel(normalized),
        total: Number((order.totalCents ?? 0) / 100),
        city: order.city ?? '',
        createdAt: order.createdAt.toISOString(),
      };
    });

    let payload: UIPayload = {
      title: 'דשבורד סטטוסים',
      view: 'dashboard',
      blocks: [
        { type: 'kpis', items: kpiItems },
        {
          type: 'table',
          columns: [
            { key: 'number', label: 'הזמנה' },
            { key: 'customer', label: 'לקוח' },
            { key: 'status', label: 'סטטוס', format: 'status' },
            { key: 'total', label: 'סכום', format: 'currency' },
            { key: 'city', label: 'עיר' },
            { key: 'createdAt', label: 'נוצר', format: 'date' },
          ],
          rows,
          emptyText: 'אין הזמנות מתאימות לסינון',
        },
      ],
      nextSuggestions: [
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.pending_goods_receipt')!,
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.pending_installations')!,
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'map.orders_by_status')!,
      ].filter(Boolean) as NextSuggestion[],
      statePatch: {
        lastActionId: 'reports.status_dashboard',
        lastFilters: params,
      },
    };

    const geminiResult = await summarizeWithGemini(payload, ctx);
    payload = {
      ...payload,
      blocks: geminiResult.blocks,
      nextSuggestions: [...payload.nextSuggestions, ...(geminiResult.next ?? [])],
      statePatch: {
        ...payload.statePatch,
        geminiCacheId: geminiResult.cacheId ?? ctx.state.geminiCacheId ?? undefined,
      },
    };

    return payload;
  },
};

const pendingGoodsReceiptAction: ActionDefinition<typeof baseFilterSchema> = {
  id: 'reports.pending_goods_receipt',
  paramsSchema: baseFilterSchema,
  handler: async (params, ctx) => {
    const where: any = { deletedAt: null };
    if (params.dateFrom) where.createdAt = { ...(where.createdAt || {}), gte: new Date(params.dateFrom) };
    if (params.dateTo) where.createdAt = { ...(where.createdAt || {}), lte: new Date(params.dateTo) };
    if (params.city) where.city = { contains: params.city };
    if (params.status?.length) where.status = { in: params.status };

    const rawOrders = await prisma.order.findMany({
      where: { ...where, status: { in: ['AWAITING_STOCK', 'PARTIALLY_SUPPLIED', 'PO_CREATED'] } },
      include: { customer: { select: { name: true } }, items: true },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    const rows = rawOrders.map((row: any) => ({
      id: row.id,
      number: row.number,
      customer: row.customer?.name ?? row.customerName ?? 'לא ידוע',
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      pendingItems: Array.isArray(row.items) ? row.items.filter((i: any) => (i.pendingQty ?? 0) > 0).length : 0,
    }));

    return {
      title: 'ממתינים לקבלת סחורה',
      view: 'report',
      blocks: [
        {
          type: 'kpis',
          items: [
            { label: 'סה״כ הזמנות', value: rows.length },
            {
              label: 'מוצרים ממתינים',
              value: rows.reduce((acc, row) => acc + (row.pendingItems || 0), 0),
            },
          ],
        },
        {
          type: 'table',
          columns: [
            { key: 'number', label: 'הזמנה' },
            { key: 'customer', label: 'לקוח' },
            { key: 'pendingItems', label: 'שורות בהמתנה' },
            { key: 'createdAt', label: 'נוצר ב', format: 'date' },
          ],
          rows,
          emptyText: 'אין הזמנות שממתינות לקבלת סחורה',
        },
      ],
      nextSuggestions: [
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'orders.set_status') || {
          id: 'orders.set_status',
          label: 'עדכון סטטוס להזמנה נבחרת',
          paramsHint: {},
        },
      ] as NextSuggestion[],
      statePatch: {
        lastActionId: 'reports.pending_goods_receipt',
        lastFilters: params,
      },
    };
  },
};

const pendingInstallationsAction: ActionDefinition<typeof baseFilterSchema> = {
  id: 'reports.pending_installations',
  paramsSchema: baseFilterSchema,
  handler: async (params, ctx) => {
    const where: any = { deletedAt: null };
    if (params.dateFrom) where.createdAt = { gte: new Date(params.dateFrom) };
    if (params.dateTo) where.createdAt = { ...(where.createdAt || {}), lte: new Date(params.dateTo) };
    if (params.city) where.city = { contains: params.city };

    const rawOrders = await prisma.order.findMany({
      where: { ...where, status: { in: ['READY_FOR_INSTALL', 'SCHEDULED', 'AWAITING_INSTALL'] } },
      include: { customer: { select: { name: true } }, assignedUser: { select: { name: true } } },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    });

    const rows = rawOrders.map((row: any) => ({
      id: row.id,
      number: row.number,
      customer: row.customer?.name ?? row.customerName ?? 'לא ידוע',
      city: row.city ?? '',
      status: getStatusLabel(normalizeOrderStatus(row.status)),
      scheduledAt: row.scheduledAt?.toISOString?.() ?? row.scheduledAt,
      assignedTo: row.assignedUser?.name ?? '',
    }));

    const groupedByCity = rows.reduce<Record<string, number>>((acc, row) => {
      const city = row.city || 'ללא עיר';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    const cards = Object.entries(groupedByCity).map(([city, count]) => ({
      title: city,
      value: count,
    }));

    return {
      title: 'התקנות בתכנון/בהמתנה',
      view: 'report',
      blocks: [
        { type: 'cards', items: cards },
        {
          type: 'table',
          columns: [
            { key: 'number', label: 'הזמנה' },
            { key: 'customer', label: 'לקוח' },
            { key: 'city', label: 'עיר' },
            { key: 'status', label: 'סטטוס', format: 'status' },
            { key: 'scheduledAt', label: 'מועד', format: 'date' },
            { key: 'assignedTo', label: 'אחראי' },
          ],
          rows,
          emptyText: 'אין התקנות ממתינות לתיאום',
        },
      ],
      nextSuggestions: [
        {
          id: 'calendar.sync_installation_event',
          label: 'סנכרן ביומן',
          paramsHint: { orderId: rows[0]?.id },
        },
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reminders.send_day_before')!,
      ].filter(Boolean) as NextSuggestion[],
      statePatch: {
        lastActionId: 'reports.pending_installations',
        lastFilters: params,
      },
    };
  },
};

const historicalOrdersAction: ActionDefinition<typeof historicalSchema> = {
  id: 'reports.historical_orders',
  paramsSchema: historicalSchema,
  handler: async (params, ctx) => {
    const months = params.months ?? 6;
    const dateFrom = params.dateFrom
      ? new Date(params.dateFrom)
      : new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);

    const where: any = { deletedAt: null, createdAt: { gte: dateFrom } };
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
    if (params.city) where.city = { contains: params.city };
    if (params.status?.length) where.status = { in: params.status };

    const rawOrders = await prisma.order.findMany({
      where: { ...where, status: 'COMPLETED' },
      include: { customer: { select: { name: true } } },
      take: 100,
      orderBy: { completedAt: 'desc' },
    });

    const rows = rawOrders.map((row: any) => ({
      id: row.id,
      number: row.number,
      customer: row.customer?.name ?? row.customerName ?? 'לא ידוע',
      status: getStatusLabel(normalizeOrderStatus(row.status)),
      total: Number((row.totalCents ?? 0) / 100),
      completedAt: row.completedAt?.toISOString?.() ?? row.createdAt?.toISOString?.() ?? row.createdAt,
    }));

    const monthly: Record<string, { total: number; count: number }> = {};
    rows.forEach((row) => {
      const key = row.completedAt ? row.completedAt.slice(0, 7) : 'לא ידוע';
      monthly[key] = monthly[key] || { total: 0, count: 0 };
      monthly[key].count += 1;
      monthly[key].total += Number(row.total ?? 0);
    });

    const kpiItems = Object.entries(monthly).map(([month, agg]) => ({
      label: month,
      value: agg.count,
      helper: `₪${agg.total.toLocaleString('he-IL')}`,
    }));

    return {
      title: 'היסטוריית הזמנות',
      view: 'report',
      blocks: [
        { type: 'kpis', items: kpiItems },
        {
          type: 'table',
          columns: [
            { key: 'number', label: 'הזמנה' },
            { key: 'customer', label: 'לקוח' },
            { key: 'status', label: 'סטטוס', format: 'status' },
            { key: 'total', label: 'סכום', format: 'currency' },
            { key: 'completedAt', label: 'הושלם ב', format: 'date' },
          ],
          rows,
          emptyText: 'אין נתונים לתקופה שנבחרה',
        },
      ],
      nextSuggestions: [
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.status_dashboard')!,
        DEFAULT_ACTION_SUGGESTIONS.find((s) => s.id === 'reports.pending_installations')!,
      ].filter(Boolean) as NextSuggestion[],
      statePatch: {
        lastActionId: 'reports.historical_orders',
        lastFilters: params,
      },
    };
  },
};

export const reportActions: Record<string, ActionDefinition<any>> = {
  [statusDashboardAction.id]: statusDashboardAction,
  [pendingGoodsReceiptAction.id]: pendingGoodsReceiptAction,
  [pendingInstallationsAction.id]: pendingInstallationsAction,
  [historicalOrdersAction.id]: historicalOrdersAction,
};
