/**
 * Order Entity UI Contract
 *
 * Defines the standard UI patterns for Order entity across all CRUD operations.
 * This contract ensures consistency in:
 * - Profile page layout (tabs, summary cards, quick actions)
 * - Form layout (create/edit)
 * - List view (table columns, filters, bulk actions)
 * - Quick edit surfaces (drawer fields)
 */

export const OrderContract = {
  /**
   * PROFILE PAGE
   * Template: ProfilePage
   * Used in: /orders/[id]
   */
  profile: {
    template: 'ProfilePage',

    header: {
      title: (order: any) => `הזמנה #${order.id.slice(0, 8)}`,
      status: (order: any) => order.status,
      owner: (order: any) => ({
        name: order.assignedTo?.name || 'לא מוקצה',
        avatar: order.assignedTo?.avatar,
      }),
      quickActions: ['edit', 'changeStatus', 'duplicate', 'delete', 'print', 'export'],
    },

    blockers: {
      enabled: true,
      detectorFn: 'detectOrderBlockers', // from shared/lib/blockers/order-blockers.ts
    },

    tabs: [
      {
        id: 'timeline',
        labelHe: 'ציר זמן',
        component: 'OrderTimeline',
        description: 'Activity history and status changes',
      },
      {
        id: 'items',
        labelHe: 'פריטים',
        component: 'OrderItems',
        description: 'Order line items with allocation status',
      },
      {
        id: 'notes',
        labelHe: 'הערות',
        component: 'OrderNotes',
        description: 'Internal notes and comments',
      },
      {
        id: 'documents',
        labelHe: 'מסמכים',
        component: 'OrderDocuments',
        description: 'Invoices, receipts, and attachments',
      },
      {
        id: 'audit',
        labelHe: 'היסטוריה',
        component: 'OrderAudit',
        description: 'Full audit trail of changes',
      },
    ],

    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטי הזמנה',
          fields: [
            { key: 'customer', label: 'לקוח', type: 'link', linkTo: '/customers/:customerId' },
            { key: 'channel', label: 'ערוץ', type: 'badge' },
            { key: 'priority', label: 'עדיפות', type: 'badge' },
            { key: 'createdAt', label: 'תאריך יצירה', type: 'date' },
            { key: 'assignedTo', label: 'מוקצה ל', type: 'user' },
          ],
        },
        {
          id: 'dates',
          title: 'תאריכים',
          fields: [
            { key: 'estimatedDelivery', label: 'תאריך משלוח משוער', type: 'date' },
            { key: 'installationDate', label: 'תאריך התקנה', type: 'date' },
            { key: 'completedAt', label: 'תאריך השלמה', type: 'date' },
          ],
        },
        {
          id: 'financials',
          title: 'כספים',
          fields: [
            { key: 'totalCents', label: 'סכום כולל', type: 'currency' },
            { key: 'paidCents', label: 'שולם', type: 'currency' },
            { key: 'balanceCents', label: 'יתרה', type: 'currency' },
            { key: 'paymentStatus', label: 'סטטוס תשלום', type: 'status' },
            { key: 'paymentMethod', label: 'אמצעי תשלום', type: 'text' },
          ],
        },
        {
          id: 'logistics',
          title: 'לוגיסטיקה',
          fields: [
            { key: 'address', label: 'כתובת', type: 'address' },
            { key: 'city', label: 'עיר', type: 'text' },
            { key: 'deliveryNotes', label: 'הערות משלוח', type: 'text' },
          ],
        },
      ],
    },
  },

  /**
   * FORM (CREATE/EDIT)
   * Template: FormPage
   * Used in: /orders/new, /orders/[id]/edit
   */
  form: {
    template: 'FormPage',

    sections: [
      {
        id: 'customer',
        title: 'לקוח',
        description: 'בחר לקוח קיים או צור חדש',
        fields: [
          { key: 'customerId', label: 'לקוח', type: 'select', required: true },
          { key: 'contactId', label: 'איש קשר', type: 'select', required: false },
        ],
        required: true,
      },
      {
        id: 'items',
        title: 'פריטים',
        description: 'הוסף מוצרים להזמנה',
        component: 'OrderItemsForm',
        required: true,
      },
      {
        id: 'logistics',
        title: 'לוגיסטיקה',
        description: 'פרטי משלוח והתקנה',
        fields: [
          { key: 'address', label: 'כתובת', type: 'text', required: true },
          { key: 'city', label: 'עיר', type: 'text', required: true },
          { key: 'apartment', label: 'דירה', type: 'text', required: false },
          { key: 'deliveryNotes', label: 'הערות משלוח', type: 'textarea', required: false },
          {
            key: 'estimatedDelivery',
            label: 'תאריך משלוח משוער',
            type: 'date',
            required: false,
          },
        ],
      },
      {
        id: 'financials',
        title: 'כספים',
        description: 'פרטי תשלום ומחיר',
        fields: [
          { key: 'paymentMethod', label: 'אמצעי תשלום', type: 'select', required: true },
          { key: 'paymentStatus', label: 'סטטוס תשלום', type: 'select', required: true },
          { key: 'totalCents', label: 'סכום כולל (אגורות)', type: 'number', required: true },
          { key: 'paidCents', label: 'שולם (אגורות)', type: 'number', required: false },
        ],
      },
      {
        id: 'metadata',
        title: 'נוסף',
        description: 'מידע נוסף',
        fields: [
          { key: 'priority', label: 'עדיפות', type: 'select', required: false },
          { key: 'assignedToId', label: 'מוקצה ל', type: 'select', required: false },
          { key: 'internalNotes', label: 'הערות פנימיות', type: 'textarea', required: false },
        ],
      },
    ],
  },

  /**
   * LIST VIEW
   * Template: ListPage
   * Used in: /orders
   */
  list: {
    template: 'ListPage',

    columns: [
      { key: 'id', labelHe: 'מזהה', sortable: true, width: '100px' },
      {
        key: 'customer',
        labelHe: 'לקוח',
        sortable: true,
        render: 'CustomerCell',
        width: '200px',
      },
      {
        key: 'status',
        labelHe: 'סטטוס',
        sortable: true,
        component: 'StatusChip',
        width: '150px',
      },
      {
        key: 'totalCents',
        labelHe: 'סכום',
        sortable: true,
        formatter: 'formatCurrency',
        align: 'end',
        width: '120px',
      },
      {
        key: 'createdAt',
        labelHe: 'תאריך',
        sortable: true,
        formatter: 'formatDate',
        width: '120px',
      },
      {
        key: 'city',
        labelHe: 'עיר',
        sortable: true,
        width: '120px',
      },
      {
        key: 'assignedTo',
        labelHe: 'מוקצה ל',
        sortable: true,
        render: 'UserCell',
        width: '150px',
      },
      {
        key: 'actions',
        labelHe: '',
        component: 'RowActions',
        width: '50px',
        sticky: 'end',
      },
    ],

    filters: [
      { key: 'status', label: 'סטטוס', type: 'multi-select', options: 'orderStatuses' },
      { key: 'customer', label: 'לקוח', type: 'search' },
      { key: 'city', label: 'עיר', type: 'multi-select', options: 'cities' },
      { key: 'channel', label: 'ערוץ', type: 'multi-select', options: 'channels' },
      { key: 'dateRange', label: 'טווח תאריכים', type: 'date-range' },
      { key: 'assignedTo', label: 'מוקצה ל', type: 'multi-select', options: 'users' },
      { key: 'priority', label: 'עדיפות', type: 'multi-select', options: 'priorities' },
    ],

    bulkActions: [
      { id: 'changeStatus', labelHe: 'שנה סטטוס', icon: 'RefreshCw', requiresConfirm: false },
      { id: 'assign', labelHe: 'הקצה ל', icon: 'UserPlus', requiresConfirm: false },
      { id: 'export', labelHe: 'ייצא', icon: 'Download', requiresConfirm: false },
      { id: 'delete', labelHe: 'מחק', icon: 'Trash', requiresConfirm: true, variant: 'danger' },
    ],

    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'quickEdit', labelHe: 'עריכה מהירה', icon: 'Zap' },
      { id: 'duplicate', labelHe: 'שכפל', icon: 'Copy' },
      { id: 'delete', labelHe: 'מחק', icon: 'Trash', variant: 'danger' },
    ],
  },

  /**
   * QUICK EDIT DRAWER
   * Surface: Drawer
   * Purpose: Fast edits to operational fields without full form
   */
  quickEdit: {
    surface: 'Drawer',
    title: 'עריכה מהירה - הזמנה',
    description: 'ערוך שדות תפעוליים במהירות',

    sections: [
      {
        id: 'address',
        title: 'כתובת',
        fields: [
          { key: 'address', label: 'כתובת', type: 'text' },
          { key: 'city', label: 'עיר', type: 'text' },
          { key: 'apartment', label: 'דירה', type: 'text' },
        ],
      },
      {
        id: 'payment',
        title: 'תשלום',
        fields: [
          { key: 'paymentMethod', label: 'אמצעי תשלום', type: 'select' },
          { key: 'paymentStatus', label: 'סטטוס תשלום', type: 'select' },
          { key: 'paidCents', label: 'שולם (אגורות)', type: 'number' },
        ],
      },
      {
        id: 'scheduling',
        title: 'תזמון',
        fields: [
          { key: 'estimatedDelivery', label: 'תאריך משלוח משוער', type: 'date' },
          { key: 'installationDate', label: 'תאריך התקנה', type: 'date' },
          { key: 'assignedToId', label: 'מוקצה ל', type: 'select' },
        ],
      },
    ],
  },
} as const;

export type OrderContractType = typeof OrderContract;
