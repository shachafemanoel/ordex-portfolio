import { ActionDefinition } from '@/lib/actions/registry';
import { Order } from '@/lib/types';
import { z } from 'zod';

export const ORDER_ACTIONS: ActionDefinition<Order>[] = [
  {
    id: 'approve-items',
    label: 'אישור פריטים',
    entityType: 'orders',
    icon: 'CheckSquare',
    isAvailable: (order) => ['DRAFT', 'PENDING_APPROVAL'].includes(order.status),
    unavailableReason: (order) => 'פעולה זו זמינה רק בהזמנות בסטטוס טיוטה או ממתין לאישור',
    ui: {
      type: 'modal',
      componentKey: 'OrderItemsConfirmation',
      title: 'אישור פריטים',
      size: 'lg',
    },
    payloadSchema: z.object({
      confirmed: z.boolean(),
    }),
  },
  {
    id: 'update-address',
    label: 'עדכון כתובת',
    entityType: 'orders',
    icon: 'MapPin',
    isAvailable: (order) => order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && order.status !== 'CLOSED',
    unavailableReason: (order) => 'לא ניתן לערוך כתובת בהזמנה סגורה או מבוטלת',
    ui: {
      type: 'drawer',
      componentKey: 'AddressEditor',
      title: 'עדכון כתובת',
      description: 'עדכן את כתובת המשלוח והחשבונית',
    },
    payloadSchema: z.object({
      city: z.string().min(2, 'עיר חובה'),
      street: z.string().min(2, 'רחוב חובה'),
      number: z.string().min(1, 'מספר בית חובה'),
      floor: z.string().optional(),
      apartment: z.string().optional(),
      notes: z.string().optional(),
      lat: z.number().optional().nullable(),
      lng: z.number().optional().nullable(),
    }),
  },
  {
    id: 'receive-goods',
    label: 'קבלת סחורה',
    entityType: 'orders',
    icon: 'PackageCheck',
    isAvailable: (order) =>
      ['PO_CREATED', 'AWAITING_STOCK', 'PARTIALLY_SUPPLIED'].includes(order.status),
    unavailableReason: (order) => 'פעולה זו זמינה רק בהזמנות שממתינות לסחורה',
    ui: {
      type: 'modal',
      componentKey: 'GoodsReceipt',
      title: 'קבלת סחורה',
      size: 'lg',
    },
    payloadSchema: z.object({
        items: z.array(z.object({
            id: z.string(),
            receivedQuantity: z.number().min(0),
            received: z.boolean()
        }))
    })
  },
  {
    id: 'schedule-installation',
    label: 'תיאום התקנה',
    entityType: 'orders',
    icon: 'Calendar',
    isAvailable: (order) =>
      ['READY_FOR_INSTALL', 'SCHEDULED', 'AWAITING_INSTALL'].includes(order.status),
    unavailableReason: (order) => {
      if (['DRAFT', 'TO_DO', 'CALL_BACK', 'PO_CREATED', 'AWAITING_STOCK'].includes(order.status))
        return 'יש להשלים קבלת סחורה לפני תיאום התקנה';
      return 'הסטטוס הנוכחי לא מאפשר תיאום';
    },
    ui: {
      type: 'modal',
      componentKey: 'ScheduleInstallation',
      title: 'תיאום התקנה',
      size: 'lg',
    },
    payloadSchema: z.object({
        scheduledAt: z.string(),
        installerId: z.string().optional().nullable(),
        installerName: z.string().optional().nullable(),
        installerNotes: z.string().optional().nullable(),
        address: z.object({
            city: z.string(),
            street: z.string(),
            number: z.string(),
            floor: z.string().optional(),
            lat: z.number().optional().nullable(),
            lng: z.number().optional().nullable()
        })
    })
  },
  {
    id: 'update-payment',
    label: 'עדכון תשלום',
    entityType: 'orders',
    icon: 'CreditCard',
    isAvailable: (order) => order.status !== 'CANCELLED',
    unavailableReason: (order) => 'לא ניתן לעדכן תשלום בהזמנה מבוטלת',
    ui: {
      type: 'modal',
      componentKey: 'PaymentEditor',
      title: 'עדכון תשלום',
      size: 'md',
    },
    payloadSchema: z.object({
        method: z.string(),
        amountCents: z.number().int(),
        status: z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED']),
        reference: z.string().optional(),
        notes: z.string().optional()
    })
  },
];
