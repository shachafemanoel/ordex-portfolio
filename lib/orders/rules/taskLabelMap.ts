// TaskLabel was removed from the Prisma schema; define locally as a string constant
export const TaskLabel = {
  VERIFY_PAYMENT: 'VERIFY_PAYMENT',
  CALLBACK_CUSTOMER: 'CALLBACK_CUSTOMER',
  VERIFY_STOCK: 'VERIFY_STOCK',
  CREATE_PURCHASE_ORDER: 'CREATE_PURCHASE_ORDER',
  ASSIGN_SUPPLIERS: 'ASSIGN_SUPPLIERS',
  WAIT_SUPPLIER_DELIVERY: 'WAIT_SUPPLIER_DELIVERY',
  RECEIVE_GOODS: 'RECEIVE_GOODS',
  RECEIVE_GOODS_PARTIAL: 'RECEIVE_GOODS_PARTIAL',
  SCHEDULE_INSTALLATION: 'SCHEDULE_INSTALLATION',
  WAIT_INSTALLATION_DAY: 'WAIT_INSTALLATION_DAY',
  CLOSE_ORDER: 'CLOSE_ORDER',
  VERIFY_ORDER: 'VERIFY_ORDER',
} as const;

export type TaskLabel = (typeof TaskLabel)[keyof typeof TaskLabel];

export const TASK_LABEL_HE: Record<TaskLabel, string> = {
  [TaskLabel.VERIFY_PAYMENT]: 'בדיקת תשלום',
  [TaskLabel.CALLBACK_CUSTOMER]: 'לחזור ללקוח',
  [TaskLabel.VERIFY_STOCK]: 'בדיקת מלאי',
  [TaskLabel.CREATE_PURCHASE_ORDER]: 'הוצאת הזמנת רכש',
  [TaskLabel.WAIT_SUPPLIER_DELIVERY]: 'ממתין לספק',
  [TaskLabel.RECEIVE_GOODS_PARTIAL]: 'קליטת סחורה חלקית',
  [TaskLabel.SCHEDULE_INSTALLATION]: 'תאום התקנה',
  [TaskLabel.WAIT_INSTALLATION_DAY]: 'ממתין להתקנה או הספקה',
  [TaskLabel.CLOSE_ORDER]: 'סיום הזמנה',
  [TaskLabel.VERIFY_ORDER]: 'בדיקת הזמנה',
  [TaskLabel.ASSIGN_SUPPLIERS]: 'שיוך ספקים',
  [TaskLabel.RECEIVE_GOODS]: 'קליטת סחורה',
};
