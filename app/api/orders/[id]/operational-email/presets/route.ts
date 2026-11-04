import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { DEFAULT_WORKSPACE_STORE_ID } from '@/lib/services/google-workspace/InstallationGoogleCalendarService';
import {
  GoogleWorkspaceIntegrationStatus,
  NotificationChannel,
  OperationalMessageKind,
} from '@prisma/client';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

type PresetRow = {
  key: string;
  operationalKind: OperationalMessageKind;
  label: string;
  hint: string;
  hasTemplate: boolean;
  defaultTo: string | null;
  supplierId: string | null;
  disabledReason: string | null;
};

async function hasActiveEmailTemplate(kind: OperationalMessageKind): Promise<boolean> {
  const t = await prisma.messageTemplate.findFirst({
    where: {
      operationalKind: kind,
      channel: NotificationChannel.EMAIL,
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(t);
}

function primarySupplierFromOrderItems(
  items: Array<{
    supplierId: string | null;
    supplier: { id: string; email: string | null; name: string } | null;
  }>
): { supplierId: string; email: string; name: string } | null {
  const scores = new Map<string, { email: string; name: string; count: number }>();
  for (const row of items) {
    if (!row.supplierId || !row.supplier?.email?.trim()) continue;
    const cur = scores.get(row.supplierId);
    if (cur) {
      cur.count += 1;
    } else {
      scores.set(row.supplierId, {
        email: row.supplier.email.trim(),
        name: row.supplier.name,
        count: 1,
      });
    }
  }
  let best: { supplierId: string; email: string; name: string; count: number } | null = null;
  for (const [supplierId, v] of scores) {
    if (!best || v.count > best.count) {
      best = { supplierId, email: v.email, name: v.name, count: v.count };
    }
  }
  return best ? { supplierId: best.supplierId, email: best.email, name: best.name } : null;
}

export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    try {
      const [integration, order] = await Promise.all([
        prisma.workspaceGoogleIntegration.findUnique({
          where: { storeId: DEFAULT_WORKSPACE_STORE_ID },
        }),
        prisma.order.findUnique({
          where: { id: params.id },
          include: {
            customer: { select: { email: true } },
            items: { include: { supplier: { select: { id: true, email: true, name: true } } } },
          },
        }),
      ]);

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      const googleReady =
        integration?.status === GoogleWorkspaceIntegrationStatus.ACTIVE;

      const customerEmail =
        order.customer?.email?.trim() ||
        order.customerEmail?.trim() ||
        null;

      const [hasDeliveryTpl, hasSupplierTpl] = await Promise.all([
        hasActiveEmailTemplate(OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION),
        hasActiveEmailTemplate(OperationalMessageKind.ORDER_ITEMS_SUPPLIER),
      ]);

      const primarySupplier = primarySupplierFromOrderItems(order.items);

      const presets: PresetRow[] = [
        {
          key: 'delivery_schedule',
          operationalKind: OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION,
          label: 'תיאום משלוח (ללקוח)',
          hint: 'נשלח ללקוח לפי תבנית DELIVERY_SCHEDULE_COORDINATION',
          hasTemplate: hasDeliveryTpl,
          defaultTo: customerEmail,
          supplierId: null,
          disabledReason: !googleReady
            ? 'חיבור Google Workspace לא פעיל'
            : !hasDeliveryTpl
              ? 'אין תבנית אימייל פעילה לסוג זה (אדמין → תבניות)'
              : !customerEmail
                ? 'אין אימייל ללקוח בהזמנה'
                : null,
        },
        {
          key: 'order_items_supplier',
          operationalKind: OperationalMessageKind.ORDER_ITEMS_SUPPLIER,
          label: 'פריטי הזמנה לספק',
          hint: 'נשלח לספק לפי תבנית ORDER_ITEMS_SUPPLIER',
          hasTemplate: hasSupplierTpl,
          defaultTo: primarySupplier?.email ?? null,
          supplierId: primarySupplier?.supplierId ?? null,
          disabledReason: !googleReady
            ? 'חיבור Google Workspace לא פעיל'
            : !hasSupplierTpl
              ? 'אין תבנית אימייל פעילה לסוג זה (אדמין → תבניות)'
              : !primarySupplier
                ? 'אין פריטים עם ספק ואימייל'
                : null,
        },
      ];

      return createSuccessResponse({
        googleReady,
        presets,
      });
    } catch (e) {
      console.error('[operational-email/presets]', e);
      return createErrorResponse('Failed to load presets', 500);
    }
  },
  { permissions: ['VIEW_ORDERS'] }
);
