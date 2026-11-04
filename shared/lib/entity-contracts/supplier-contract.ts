/**
 * Supplier Entity UI Contract
 */

export const SupplierContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (supplier: any) => supplier.name,
      status: () => null,
      owner: () => null,
      quickActions: ['edit', 'create_po', 'view_performance', 'export'],
    },
    blockers: { enabled: false },
    tabs: [
      { id: 'pos', labelHe: 'הזמנות רכש', component: 'SupplierPOs' },
      { id: 'products', labelHe: 'מוצרים', component: 'SupplierProducts' },
      { id: 'performance', labelHe: 'ביצועים', component: 'SupplierPerformance' },
      { id: 'contacts', labelHe: 'אנשי קשר', component: 'SupplierContacts' },
      { id: 'notes', labelHe: 'הערות', component: 'SupplierNotes' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'SupplierAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטי ספק',
          fields: [
            { key: 'email', label: 'אימייל', type: 'email' },
            { key: 'phone', label: 'טלפון', type: 'phone' },
            { key: 'govId', label: 'ח.פ', type: 'text' },
            { key: 'createdAt', label: 'ספק מאז', type: 'date' },
          ],
        },
        {
          id: 'address',
          title: 'כתובת',
          fields: [
            { key: 'address', label: 'כתובת', type: 'text' },
            { key: 'city', label: 'עיר', type: 'text' },
          ],
        },
        {
          id: 'terms',
          title: 'תנאי עבודה',
          fields: [
            { key: 'paymentTerms', label: 'תנאי תשלום', type: 'text' },
            { key: 'leadTimeDays', label: 'זמן אספקה (ימים)', type: 'number' },
            { key: 'minimumOrder', label: 'הזמנה מינימלית', type: 'currency' },
          ],
        },
        {
          id: 'metrics',
          title: 'מדדי ביצועים',
          fields: [
            { key: 'rating', label: 'דירוג', type: 'rating' },
            { key: 'onTimeDeliveryRate', label: 'אספקה בזמן', type: 'percentage' },
            { key: 'qualityScore', label: 'ציון איכות', type: 'score' },
            { key: 'totalPOs', label: 'הזמנות רכש', type: 'number' },
          ],
        },
      ],
    },
  },
  form: {
    template: 'FormPage',
    sections: [
      {
        id: 'basic',
        title: 'פרטים בסיסיים',
        fields: [
          { key: 'name', label: 'שם ספק', type: 'text', required: true },
          { key: 'email', label: 'אימייל', type: 'email', required: false },
          { key: 'phone', label: 'טלפון', type: 'tel', required: true },
          { key: 'govId', label: 'ח.פ', type: 'text' },
        ],
        required: true,
      },
      {
        id: 'address',
        title: 'כתובת',
        fields: [
          { key: 'address', label: 'כתובת', type: 'text' },
          { key: 'city', label: 'עיר', type: 'text' },
        ],
      },
      {
        id: 'terms',
        title: 'תנאי עבודה',
        fields: [
          { key: 'paymentTerms', label: 'תנאי תשלום', type: 'text' },
          { key: 'leadTimeDays', label: 'זמן אספקה (ימים)', type: 'number' },
          { key: 'minimumOrder', label: 'הזמנה מינימלית (אגורות)', type: 'number' },
          { key: 'shippingCost', label: 'עלות משלוח (אגורות)', type: 'number' },
        ],
      },
      {
        id: 'contacts',
        title: 'אנשי קשר',
        component: 'SupplierContactsForm',
      },
    ],
  },
  list: {
    template: 'ListPage',
    columns: [
      { key: 'name', labelHe: 'שם', sortable: true, width: '200px' },
      { key: 'email', labelHe: 'אימייל', sortable: true, width: '180px' },
      { key: 'phone', labelHe: 'טלפון', sortable: false, width: '130px' },
      { key: 'city', labelHe: 'עיר', sortable: true, width: '120px' },
      { key: 'rating', labelHe: 'דירוג', sortable: true, render: 'RatingCell', width: '100px' },
      { key: 'totalPOs', labelHe: 'הזמנות רכש', sortable: true, width: '100px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px' },
    ],
    filters: [
      { key: 'rating', label: 'דירוג', type: 'multi-select', options: 'ratings' },
      { key: 'city', label: 'עיר', type: 'multi-select', options: 'cities' },
    ],
    bulkActions: [
      { id: 'export', labelHe: 'ייצא', icon: 'Download' },
      { id: 'send_message', labelHe: 'שלח הודעה', icon: 'MessageSquare' },
    ],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'create_po', labelHe: 'צור הזמנת רכש', icon: 'Plus' },
      { id: 'view_performance', labelHe: 'הצג ביצועים', icon: 'BarChart' },
    ],
  },
} as const;
