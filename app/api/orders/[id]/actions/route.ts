import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Action catalogue ──────────────────────────────────────────────────────
interface MobileAction {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  isPrimary: boolean;
  requiresConfirmation: boolean;
  targetStatus: string | null;
}

function actionsForStatus(status: string, paymentStatus: string): MobileAction[] {
  const fallback: MobileAction = {
    id: 'update-status',
    type: 'UPDATE_STATUS',
    title: 'עדכן סטטוס',
    subtitle: null,
    isPrimary: false,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const callCustomer: MobileAction = {
    id: 'call-customer',
    type: 'CALL_CUSTOMER',
    title: 'התקשר ללקוח',
    subtitle: 'יצירת קשר טלפוני',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const whatsapp: MobileAction = {
    id: 'whatsapp-customer',
    type: 'WHATSAPP_CUSTOMER',
    title: 'WhatsApp ללקוח',
    subtitle: 'שלח הודעה',
    isPrimary: false,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const confirmDetails: MobileAction = {
    id: 'confirm-details',
    type: 'CONFIRM_DETAILS',
    title: 'אשר פרטי הזמנה',
    subtitle: 'פרטים ותשלום',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const confirmPayment: MobileAction = {
    id: 'confirm-payment',
    type: 'CONFIRM_PAYMENT',
    title: 'אשר תשלום',
    subtitle: 'יתרה לתשלום',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const checkStock: MobileAction = {
    id: 'check-stock',
    type: 'CHECK_STOCK',
    title: 'בדוק זמינות מלאי',
    subtitle: 'בדיקת פריטים',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const receiveItems: MobileAction = {
    id: 'receive-items',
    type: 'RECEIVE_ITEMS',
    title: 'קלוט סחורה',
    subtitle: 'עדכן פריטים שהתקבלו',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const reportIssue: MobileAction = {
    id: 'report-issue',
    type: 'REPORT_ISSUE',
    title: 'דווח בעיה',
    subtitle: 'הוסף הערה לבעיה',
    isPrimary: false,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const scheduleInstall: MobileAction = {
    id: 'schedule-installation',
    type: 'SCHEDULE_INSTALLATION',
    title: 'תאם התקנה',
    subtitle: 'קבע תאריך ושעה',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const openNavigation: MobileAction = {
    id: 'open-navigation',
    type: 'OPEN_NAVIGATION',
    title: 'פתח ניווט',
    subtitle: 'נווט לכתובת',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: null,
  };

  const markInstalled: MobileAction = {
    id: 'mark-installed',
    type: 'UPDATE_STATUS',
    title: 'סמן כהותקן',
    subtitle: 'סיים התקנה',
    isPrimary: true,
    requiresConfirmation: true,
    targetStatus: 'INSTALLED',
  };

  const prepareShipment: MobileAction = {
    id: 'prepare-shipment',
    type: 'PREPARE_SHIPMENT',
    title: 'הכן למשלוח',
    subtitle: 'איסוף והעמסה',
    isPrimary: true,
    requiresConfirmation: false,
    targetStatus: 'READY',
  };

  const partialInstall: MobileAction = {
    id: 'partial-install',
    type: 'PARTIAL_INSTALL',
    title: 'התקנה חלקית',
    subtitle: 'דיווח על התקנה חלקית',
    isPrimary: false,
    requiresConfirmation: false,
    targetStatus: 'INSTALLED',
  };

  const unpaidConfirmPayment = paymentStatus !== 'PAID' ? confirmPayment : null;

  switch (status) {
    case 'CALL_BACK':
      return [callCustomer, whatsapp, confirmDetails, fallback].filter(Boolean) as MobileAction[];

    case 'TO_DO':
    case 'CONFIRMED':
    case 'RECEIVED':
      return [checkStock, prepareShipment, ...(unpaidConfirmPayment ? [unpaidConfirmPayment] : []), fallback];

    case 'PO_CREATED':
    case 'AWAITING_STOCK':
    case 'PARTIALLY_SUPPLIED':
      return [receiveItems, prepareShipment, reportIssue, fallback];

    case 'INSTALL_SCHEDULING':
    case 'READY_FOR_INSTALL':
    case 'READY':
      return [prepareShipment, scheduleInstall, callCustomer, whatsapp];

    case 'AWAITING_INSTALL':
    case 'SCHEDULED':
      return [markInstalled, openNavigation, callCustomer, whatsapp, partialInstall, reportIssue];

    case 'SUPPLIED':
    case 'COMPLETED':
    case 'INSTALLED':
    case 'INVOICED':
    case 'CLOSED':
    case 'CANCELLED':
    case 'REFUNDED':
      return [fallback];

    default:
      return [fallback];
  }
}

// ─── GET /api/orders/[id]/actions ─────────────────────────────────────────
export const GET = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const { id: orderId } = params;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, paymentStatus: true },
      });

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      const actions = actionsForStatus(order.status, order.paymentStatus);
      return createSuccessResponse(actions);
    } catch (error: any) {
      console.error('[GET /api/orders/[id]/actions] error:', error);
      return createErrorResponse(error?.message || 'Internal Error', 500);
    }
  }
);
// ─── POST /api/orders/[id]/actions ────────────────────────────────────────
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const { id: orderId } = params;
      const body = await req.json();
      const { action, payload } = body as { action: string; payload?: Record<string, any> };

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      const { ORDER_ACTION_HANDLERS } = await import('@/lib/server/actions/orderActionHandlers');
      const handler = ORDER_ACTION_HANDLERS[action];

      if (handler) {
        const result = await handler(orderId, payload, user.id);
        return createSuccessResponse(result);
      }

      // Fallback for actions handled elsewhere or needing special logic
      const { getProductionOrdersService } = await import('@/lib/services/production');
      const ordersService = getProductionOrdersService();

      switch (action) {
        case 'MARK_SUPPLIED': {
          const targetStatus = payload?.targetStatus ?? 'SUPPLIED';
          const updated = await ordersService.changeOrderStatus(
            orderId,
            { newStatus: targetStatus as any, reason: payload?.note },
            user.id
          );
          return createSuccessResponse(updated);
        }

        case 'REPORT_ISSUE': {
          if (payload?.reason) {
            await prisma.orderNote.create({
              data: { content: `[בעיה] ${payload.reason}`, orderId, userId: user.id },
            });
          }
          return createSuccessResponse(order);
        }

        case 'UPDATE_STATUS':
        case 'PARTIAL_INSTALL': {
          if (!payload?.targetStatus) {
            return createErrorResponse('targetStatus required', 400);
          }
          const updated = await ordersService.changeOrderStatus(
            orderId,
            { newStatus: payload.targetStatus as any, reason: payload.reason || payload.note },
            user.id
          );
          
          if (action === 'PARTIAL_INSTALL' && payload?.installedItems) {
             await prisma.orderNote.create({
               data: { 
                 content: `[התקנה חלקית] פריטים שהותקנו: ${payload.installedItems.filter((i: any) => i.isInstalled).length} מתוך ${payload.installedItems.length}`,
                 orderId,
                 userId: user.id 
               },
             });
          }
          
          return createSuccessResponse(updated);
        }

        default:
          return createErrorResponse(`Action ${action} is not implemented`, 400);
      }
    } catch (error: any) {
      console.error('[POST /api/orders/[id]/actions] error:', error);
      return createErrorResponse(error?.message || 'Internal Error', 500);
    }
  }
);
