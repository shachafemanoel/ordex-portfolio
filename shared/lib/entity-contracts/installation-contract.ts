/**
 * Installation Entity UI Contract
 */

export const InstallationContract = {
  profile: {
    template: 'ProfilePage',
    header: {
      title: (inst: any) => `התקנה - הזמנה #${inst.orderId?.slice(0, 8)}`,
      status: (inst: any) => inst.status,
      owner: (inst: any) => ({ name: inst.technician?.name, avatar: inst.technician?.avatar }),
      quickActions: ['edit', 'reschedule', 'start', 'complete', 'cancel'],
    },
    blockers: { enabled: true, detectorFn: 'detectInstallationBlockers' },
    tabs: [
      { id: 'details', labelHe: 'פרטים', component: 'InstallationDetails' },
      { id: 'checklist', labelHe: 'רשימת בדיקה', component: 'InstallationChecklist' },
      { id: 'photos', labelHe: 'תמונות', component: 'InstallationPhotos' },
      { id: 'notes', labelHe: 'הערות', component: 'InstallationNotes' },
      { id: 'audit', labelHe: 'היסטוריה', component: 'InstallationAudit' },
    ],
    summary: {
      cards: [
        {
          id: 'schedule',
          title: 'תזמון',
          fields: [
            { key: 'scheduledDate', label: 'תאריך', type: 'date' },
            { key: 'timeSlot', label: 'שעה', type: 'text' },
            { key: 'estimatedDuration', label: 'משך משוער', type: 'duration' },
            { key: 'actualDuration', label: 'משך בפועל', type: 'duration' },
          ],
        },
        {
          id: 'technician',
          title: 'טכנאי',
          fields: [
            { key: 'technicianId', label: 'טכנאי', type: 'user' },
            { key: 'vehicleType', label: 'סוג רכב', type: 'text' },
            { key: 'phoneNumber', label: 'טלפון', type: 'phone' },
          ],
        },
        {
          id: 'location',
          title: 'מיקום',
          fields: [
            { key: 'address', label: 'כתובת', type: 'address' },
            { key: 'city', label: 'עיר', type: 'text' },
            { key: 'accessNotes', label: 'הערות גישה', type: 'text' },
          ],
        },
      ],
    },
  },
  form: {
    template: 'FormPage',
    sections: [
      {
        id: 'order',
        title: 'הזמנה',
        fields: [{ key: 'orderId', label: 'הזמנה', type: 'select', required: true }],
        required: true,
      },
      {
        id: 'schedule',
        title: 'תזמון',
        fields: [
          { key: 'scheduledDate', label: 'תאריך', type: 'date', required: true },
          { key: 'timeSlot', label: 'שעה', type: 'time-slot', required: true },
          { key: 'estimatedDuration', label: 'משך משוער (דקות)', type: 'number' },
        ],
        required: true,
      },
      {
        id: 'assignment',
        title: 'הקצאה',
        fields: [
          { key: 'technicianId', label: 'טכנאי', type: 'select', required: true },
          { key: 'vehicleType', label: 'סוג רכב', type: 'select' },
        ],
        required: true,
      },
      {
        id: 'notes',
        title: 'הערות',
        fields: [
          { key: 'accessNotes', label: 'הערות גישה', type: 'textarea' },
          { key: 'specialInstructions', label: 'הוראות מיוחדות', type: 'textarea' },
        ],
      },
    ],
  },
  list: {
    template: 'ListPage',
    columns: [
      { key: 'orderId', labelHe: 'הזמנה', sortable: true, render: 'OrderLinkCell', width: '120px' },
      { key: 'customer', labelHe: 'לקוח', sortable: true, width: '150px' },
      { key: 'scheduledDate', labelHe: 'תאריך', sortable: true, formatter: 'formatDate', width: '120px' },
      { key: 'timeSlot', labelHe: 'שעה', sortable: true, width: '100px' },
      { key: 'technician', labelHe: 'טכנאי', sortable: true, render: 'UserCell', width: '150px' },
      { key: 'status', labelHe: 'סטטוס', sortable: true, component: 'StatusChip', width: '120px' },
      { key: 'actions', labelHe: '', component: 'RowActions', width: '50px' },
    ],
    filters: [
      { key: 'status', label: 'סטטוס', type: 'multi-select', options: 'installationStatuses' },
      { key: 'technician', label: 'טכנאי', type: 'multi-select', options: 'technicians' },
      { key: 'dateRange', label: 'טווח תאריכים', type: 'date-range' },
      { key: 'city', label: 'עיר', type: 'multi-select', options: 'cities' },
    ],
    bulkActions: [
      { id: 'reschedule', labelHe: 'תזמן מחדש', icon: 'Calendar' },
      { id: 'assign', labelHe: 'הקצה טכנאי', icon: 'UserPlus' },
      { id: 'cancel', labelHe: 'בטל', icon: 'XCircle', requiresConfirm: true, variant: 'danger' },
    ],
    rowActions: [
      { id: 'view', labelHe: 'הצג', icon: 'Eye' },
      { id: 'edit', labelHe: 'ערוך', icon: 'Edit' },
      { id: 'quickSchedule', labelHe: 'תזמון מהיר', icon: 'Zap' },
      { id: 'start', labelHe: 'התחל התקנה', icon: 'Play' },
      { id: 'complete', labelHe: 'סיים התקנה', icon: 'CheckCircle' },
    ],
  },
  quickEdit: {
    surface: 'Drawer',
    title: 'תזמון מהיר',
    sections: [
      {
        id: 'schedule',
        fields: [
          { key: 'scheduledDate', label: 'תאריך', type: 'date' },
          { key: 'timeSlot', label: 'שעה', type: 'time-slot' },
          { key: 'technicianId', label: 'טכנאי', type: 'select' },
        ],
      },
    ],
  },
} as const;
