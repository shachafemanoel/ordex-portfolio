/**
 * Purchase Order (PO) Entity UI Contract
 */

export const POContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (po: any) => `הזמנת רכש #${po.reference}`,
      status: (po: any) => po.status,
      owner: (po: any) => ({ name: po.createdBy?.name, avatar: po.createdBy?.avatar }),
      quickActions: ['edit', 'send_to_supplier', 'receive', 'cancel', 'export'],
    },
    blockers: { enabled: true, detectorFn: 'detectPOBlockers' },
    tabs: [
      { id: 'items', labelHe: 'פריטים', component: 'POItems' },
      { id: 'receipts', labelHe: 'קבלות סחורה', component: 'POReceipts' },
      { id: 'timeline', labelHe: 'ציר זמן', component: 'POTimeline' },
      { id: 'notes', labelHe: 'הערות', component: 'PONotes' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'POAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטים',
          fields: [
            { key: 'supplier', label: 'ספק', type: 'link', linkTo: '/suppliers/:supplierId' },
            { key: 'reference', label: 'מספר הזמנה', type: 'text' },
            { key: 'createdAt', label: 'תאריך יצירה', type: 'date' },
            { key: 'expectedDelivery', label: 'תאריך אספקה צפוי', type: 'date' },
          ],
        },
        {
          id: 'financials',
          title: 'כספים',
          fields: [
            { key: 'totalCents', label: 'סכום כולל', type: 'currency' },
            { key: 'currency', label: 'מטבע', type: 'text' },
            { key: 'paymentTerms', label: 'תנאי תשלום', type: 'text' },
          ],
        },
        {
          id: 'fulfillment',
          title: 'סטטוס מילוי',
          fields: [
            { key: 'totalItemsOrdered', label: 'פריטים בהזמנה', type: 'number' },
            { key: 'totalItemsReceived', label: 'פריטים שהתקבלו', type: 'number' },
            { key: 'totalItemsPending', label: 'פריטים ממתינים', type: 'number' },
            { key: 'fulfillmentPercentage', label: 'אחוז מילוי', type: 'percentage' },
          ],
        },
      ],
    },
  },
  form: {
    template: 'FormPage',
    sections: [
      {
        id: 'supplier',
        title: 'ספק',
        fields: [{ key: 'supplierId', label: 'ספק', type: 'select', required: true }],
        required: true,
      },
      {
        id: 'items',
        title: 'פריטים',
        component: 'POItemsForm',
        required: true,
      },
      {
        id: 'terms',
        title: 'תנאים',
        fields: [
          { key: 'paymentTerms', label: 'תנאי תשלום', type: 'text' },
          { key: 'deliveryTerms', label: 'תנאי משלוח', type: 'text' },
          { key: 'expectedDelivery', label: 'תאריך אספקה צפוי', type: 'date' },
        ],
      },
      {
        id: 'notes',
        title: 'הערות',
        fields: [{ key: 'notes', label: 'הערות', type: 'textarea' }],
      },
    ],
  },
  list: {
    template: 'ListPage',
    columns: [
      { key: 'reference', labelHe: 'מזהה', sortable: true, width: '120px' },
      { key: 'supplier', labelHe: 'ספק', sortable: true, render: 'SupplierCell', width: '200px' },
      { key: 'status', labelHe: 'סטטוס', sortable: true, component: 'StatusChip', width: '150px' },
      { key: 'totalCents', labelHe: 'סכום', sortable: true, formatter: 'formatCurrency', width: '120px' },
      { key: 'createdAt', labelHe: 'תאריך', sortable: true, formatter: 'formatDate', width: '120px' },
      { key: 'expectedDelivery', labelHe: 'אספקה צפויה', sortable: true, formatter: 'formatDate', width: '120px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px', sticky: 'end' },
    ],
    filters: [
      { key: 'status', label: 'סטטוס', type: 'multi-select', options: 'poStatuses' },
      { key: 'supplier', label: 'ספק', type: 'search' },
      { key: 'dateRange', label: 'טווח תאריכים', type: 'date-range' },
    ],
    bulkActions: [
      { id: 'export', labelHe: 'ייצא', icon: 'Download', requiresConfirm: false },
      { id: 'cancel', labelHe: 'בטל', icon: 'XCircle', requiresConfirm: true, variant: 'danger' },
    ],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'receive', labelHe: 'קבל סחורה', icon: 'Truck' },
      { id: 'send', labelHe: 'שלח לספק', icon: 'Send' },
      { id: 'cancel', labelHe: 'בטל', icon: 'XCircle', variant: 'danger' },
    ],
  },
  quickEdit: {
    surface: 'Drawer',
    title: 'קבלת סחורה מהירה',
    sections: [{ id: 'receiving', component: 'ReceivingForm' }],
  },
} as const;
