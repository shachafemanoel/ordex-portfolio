/**
 * Customer Entity UI Contract
 */

export const CustomerContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (customer: any) => customer.name,
      status: (customer: any) => customer.lifecycle,
      owner: (customer: any) => ({ name: customer.accountManager?.name, avatar: customer.accountManager?.avatar }),
      quickActions: ['edit', 'create_order', 'view_ledger', 'send_message', 'export'],
    },
    blockers: { enabled: true, detectorFn: 'detectCustomerBlockers' },
    tabs: [
      { id: 'orders', labelHe: 'הזמנות', component: 'CustomerOrders' },
      { id: 'contacts', labelHe: 'אנשי קשר', component: 'CustomerContacts' },
      { id: 'addresses', labelHe: 'כתובות', component: 'CustomerAddresses' },
      { id: 'notes', labelHe: 'הערות', component: 'CustomerNotes' },
      { id: 'ledger', labelHe: 'חשבונית', component: 'CustomerLedger' },
      { id: 'activity', labelHe: 'פעילות', component: 'CustomerActivity' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'CustomerAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטי לקוח',
          fields: [
            { key: 'email', label: 'אימייל', type: 'email' },
            { key: 'phone', label: 'טלפון', type: 'phone' },
            { key: 'govId', label: 'ת.ז / ח.פ', type: 'text' },
            { key: 'createdAt', label: 'לקוח מאז', type: 'date' },
          ],
        },
        {
          id: 'address',
          title: 'כתובת ראשית',
          fields: [
            { key: 'primaryAddress.address', label: 'כתובת', type: 'text' },
            { key: 'primaryAddress.city', label: 'עיר', type: 'text' },
            { key: 'primaryAddress.apartment', label: 'דירה', type: 'text' },
          ],
        },
        {
          id: 'financials',
          title: 'כספים',
          fields: [
            { key: 'currentBalanceCents', label: 'יתרה נוכחית', type: 'currency' },
            { key: 'clvCents', label: 'ערך לכל החיים', type: 'currency' },
            { key: 'creditLimitCents', label: 'מסגרת אשראי', type: 'currency' },
            { key: 'paymentTermsDays', label: 'תנאי תשלום (ימים)', type: 'number' },
          ],
        },
        {
          id: 'health',
          title: 'בריאות לקוח',
          fields: [
            { key: 'healthScore', label: 'ציון בריאות', type: 'score' },
            { key: 'riskLevel', label: 'רמת סיכון', type: 'badge' },
            { key: 'lastActivityAt', label: 'פעילות אחרונה', type: 'relative-time' },
            { key: 'ordersCount', label: 'מספר הזמנות', type: 'number' },
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
          { key: 'name', label: 'שם', type: 'text', required: true },
          { key: 'email', label: 'אימייל', type: 'email', required: false },
          { key: 'phone', label: 'טלפון', type: 'tel', required: true },
        ],
        required: true,
      },
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
        id: 'business',
        title: 'פרטים עסקיים',
        fields: [
          { key: 'govId', label: 'ת.ז / ח.פ', type: 'text' },
          { key: 'companyName', label: 'שם חברה', type: 'text' },
          { key: 'vatCategory', label: 'קטגורית מע"מ', type: 'select' },
        ],
      },
      {
        id: 'financials',
        title: 'תנאים פיננסיים',
        fields: [
          { key: 'creditLimitCents', label: 'מסגרת אשראי (אגורות)', type: 'number' },
          { key: 'paymentTermsDays', label: 'תנאי תשלום (ימים)', type: 'number' },
        ],
      },
      {
        id: 'account',
        title: 'ניהול חשבון',
        fields: [
          { key: 'accountManagerId', label: 'מנהל חשבון', type: 'select' },
          { key: 'segment', label: 'מגזר', type: 'select' },
          { key: 'tags', label: 'תגיות', type: 'tags' },
        ],
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
      { key: 'ordersCount', labelHe: 'הזמנות', sortable: true, width: '80px' },
      { key: 'currentBalanceCents', labelHe: 'יתרה', sortable: true, formatter: 'formatCurrency', width: '120px' },
      { key: 'healthScore', labelHe: 'בריאות', sortable: true, render: 'HealthScoreCell', width: '100px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px' },
    ],
    filters: [
      { key: 'lifecycle', label: 'מחזור חיים', type: 'multi-select', options: 'lifecycles' },
      { key: 'riskLevel', label: 'רמת סיכון', type: 'multi-select', options: 'riskLevels' },
      { key: 'city', label: 'עיר', type: 'multi-select', options: 'cities' },
      { key: 'segment', label: 'מגזר', type: 'multi-select', options: 'segments' },
      { key: 'accountManager', label: 'מנהל חשבון', type: 'multi-select', options: 'users' },
    ],
    bulkActions: [
      { id: 'export', labelHe: 'ייצא', icon: 'Download' },
      { id: 'send_message', labelHe: 'שלח הודעה', icon: 'MessageSquare' },
      { id: 'assign_manager', labelHe: 'הקצה מנהל', icon: 'UserPlus' },
    ],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'quickEditAddress', labelHe: 'ערוך כתובת', icon: 'MapPin' },
      { id: 'create_order', labelHe: 'צור הזמנה', icon: 'Plus' },
      { id: 'view_ledger', labelHe: 'הצג חשבונית', icon: 'FileText' },
    ],
  },
  quickEdit: {
    surface: 'Drawer',
    title: 'עריכת כתובת מהירה',
    sections: [
      {
        id: 'address',
        fields: [
          { key: 'address', label: 'כתובת', type: 'text' },
          { key: 'city', label: 'עיר', type: 'text' },
          { key: 'apartment', label: 'דירה', type: 'text' },
          { key: 'accessNotes', label: 'הערות גישה', type: 'textarea' },
        ],
      },
    ],
  },
} as const;
