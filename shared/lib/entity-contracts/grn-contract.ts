/**
 * Goods Receipt Note (GRN) Entity UI Contract
 */

export const GRNContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (grn: any) => `קבלת סחורה #${grn.reference}`,
      status: () => 'RECEIVED',
      owner: (grn: any) => ({ name: grn.receivedBy?.name, avatar: grn.receivedBy?.avatar }),
      quickActions: ['edit', 'print_label', 'export'],
    },
    blockers: { enabled: false },
    tabs: [
      { id: 'items', labelHe: 'פריטים', component: 'GRNItems' },
      { id: 'photos', labelHe: 'תמונות', component: 'GRNPhotos' },
      { id: 'notes', labelHe: 'הערות', component: 'GRNNotes' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'GRNAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטים',
          fields: [
            { key: 'supplier', label: 'ספק', type: 'link', linkTo: '/suppliers/:supplierId' },
            { key: 'purchaseOrder', label: 'הזמנת רכש', type: 'link', linkTo: '/procurement/purchase-orders/:poId' },
            { key: 'reference', label: 'מספר קבלה', type: 'text' },
            { key: 'receivedAt', label: 'תאריך קבלה', type: 'datetime' },
            { key: 'receivedBy', label: 'התקבל על ידי', type: 'user' },
          ],
        },
        {
          id: 'quantities',
          title: 'כמויות',
          fields: [
            { key: 'totalReceived', label: 'כמות שהתקבלה', type: 'number' },
            { key: 'damagedQty', label: 'פריטים פגומים', type: 'number' },
            { key: 'acceptedQty', label: 'פריטים מאושרים', type: 'number' },
          ],
        },
      ],
    },
  },
  form: {
    template: 'FormPage',
    sections: [
      {
        id: 'source',
        title: 'מקור',
        fields: [
          { key: 'supplierId', label: 'ספק', type: 'select', required: true },
          { key: 'purchaseOrderId', label: 'הזמנת רכש', type: 'select', required: false },
        ],
      },
      { id: 'items', title: 'פריטים', component: 'GRNItemsForm', required: true },
      {
        id: 'notes',
        title: 'הערות ותיעוד',
        fields: [
          { key: 'notes', label: 'הערות', type: 'textarea' },
          { key: 'photos', label: 'תמונות', type: 'file-upload', accept: 'image/*', multiple: true },
        ],
      },
    ],
  },
  list: {
    template: 'ListPage',
    columns: [
      { key: 'reference', labelHe: 'מזהה', sortable: true, width: '120px' },
      { key: 'supplier', labelHe: 'ספק', sortable: true, width: '200px' },
      { key: 'purchaseOrder', labelHe: 'הזמנת רכש', sortable: true, width: '150px' },
      { key: 'totalReceived', labelHe: 'כמות', sortable: true, width: '100px' },
      { key: 'receivedAt', labelHe: 'תאריך', sortable: true, formatter: 'formatDate', width: '120px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px' },
    ],
    filters: [
      { key: 'supplier', label: 'ספק', type: 'search' },
      { key: 'dateRange', label: 'טווח תאריכים', type: 'date-range' },
    ],
    bulkActions: [{ id: 'export', labelHe: 'ייצא', icon: 'Download' }],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'print', labelHe: 'הדפס תווית', icon: 'Printer' },
    ],
  },
} as const;
