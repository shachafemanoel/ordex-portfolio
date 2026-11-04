/**
 * Task Entity UI Contract
 */

export const TaskContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (task: any) => task.title,
      status: (task: any) => task.status,
      owner: (task: any) => ({ name: task.assignedTo?.name, avatar: task.assignedTo?.avatar }),
      quickActions: ['edit', 'complete', 'reassign', 'delete'],
    },
    blockers: { enabled: false },
    tabs: [
      { id: 'details', labelHe: 'פרטים', component: 'TaskDetails' },
      { id: 'notes', labelHe: 'הערות', component: 'TaskNotes' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'TaskAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'info',
          title: 'פרטי משימה',
          fields: [
            { key: 'type', label: 'סוג', type: 'badge' },
            { key: 'priority', label: 'עדיפות', type: 'badge' },
            { key: 'dueDate', label: 'תאריך יעד', type: 'date' },
            { key: 'createdAt', label: 'נוצר', type: 'date' },
          ],
        },
        {
          id: 'related',
          title: 'קשור ל',
          fields: [
            { key: 'orderId', label: 'הזמנה', type: 'link', linkTo: '/orders/:orderId' },
            { key: 'customerId', label: 'לקוח', type: 'link', linkTo: '/customers/:customerId' },
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
        title: 'בסיסי',
        fields: [
          { key: 'title', label: 'כותרת', type: 'text', required: true },
          { key: 'description', label: 'תיאור', type: 'textarea', required: false },
          { key: 'type', label: 'סוג', type: 'select', required: true },
        ],
        required: true,
      },
      {
        id: 'assignment',
        title: 'הקצאה ותזמון',
        fields: [
          { key: 'assignedToId', label: 'מוקצה ל', type: 'select' },
          { key: 'priority', label: 'עדיפות', type: 'select' },
          { key: 'dueDate', label: 'תאריך יעד', type: 'date' },
        ],
      },
      {
        id: 'related',
        title: 'קשור ל',
        fields: [
          { key: 'orderId', label: 'הזמנה', type: 'select' },
          { key: 'customerId', label: 'לקוח', type: 'select' },
        ],
      },
    ],
  },
  list: {
    template: 'ListPage',
    columns: [
      { key: 'title', labelHe: 'כותרת', sortable: true, width: '300px' },
      { key: 'type', labelHe: 'סוג', sortable: true, component: 'Badge', width: '120px' },
      { key: 'status', labelHe: 'סטטוס', sortable: true, component: 'StatusChip', width: '120px' },
      { key: 'assignedTo', labelHe: 'מוקצה ל', sortable: true, render: 'UserCell', width: '150px' },
      { key: 'dueDate', labelHe: 'תאריך יעד', sortable: true, formatter: 'formatDate', width: '120px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px' },
    ],
    filters: [
      { key: 'status', label: 'סטטוס', type: 'multi-select', options: 'taskStatuses' },
      { key: 'type', label: 'סוג', type: 'multi-select', options: 'taskTypes' },
      { key: 'assignedTo', label: 'מוקצה ל', type: 'multi-select', options: 'users' },
      { key: 'dateRange', label: 'תאריך יעד', type: 'date-range' },
    ],
    bulkActions: [
      { id: 'assign', labelHe: 'הקצה ל', icon: 'UserPlus' },
      { id: 'complete', labelHe: 'סמן כהושלם', icon: 'CheckCircle' },
      { id: 'delete', labelHe: 'מחק', icon: 'Trash', requiresConfirm: true, variant: 'danger' },
    ],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'complete', labelHe: 'סמן כהושלם', icon: 'CheckCircle' },
      { id: 'delete', labelHe: 'מחק', icon: 'Trash', variant: 'danger' },
    ],
  },
} as const;
