import {
  MessageTemplateTarget,
  NotificationChannel,
  OperationalMessageKind,
} from '@prisma/client';

/**
 * תבניות בסיס ללקוח — טקסט בעברית, מצייני מקום בפורמט {{מפתח}} כמו ב־TemplateRenderingService.
 * הקשר ברירת מחדל מהזמנה: OperationalEmailService.buildContextFromOrder (שמות המפתחות תואמים).
 */
export type CustomerMessageTemplatePreset = {
  /** מזהה יציב לתיעוד / ייבוא */
  key: string;
  /** שם ייחודי למסד — מומלץ לשמור כפי שהוא בייבוא ראשון */
  name: string;
  channel: NotificationChannel;
  target: MessageTemplateTarget;
  /** חובה לערוץ EMAIL */
  subject: string | null;
  content: string;
  /** רשימת מפתחות לתצוגה באדמין; חפיפה לשימוש בפועל בתוכן */
  variables: string[];
  operationalKind: OperationalMessageKind | null;
  /** הסבר קצר בעברית */
  usageHint: string;
};

/** מפתחות הקשר הנפוצים מהזמנה (ראה TemplateRenderContext / buildContextFromOrder) */
export const CUSTOMER_ORDER_TEMPLATE_VARIABLE_KEYS = [
  'orderNumber',
  'customerName',
  'city',
  'address',
  'addressLine',
  'installationDate',
  'installationTime',
  'installAt',
  'timeWindow',
  'deliveryScheduleSummary',
  'items',
  'notes',
  'notesToCrew',
] as const;

export const CUSTOMER_MESSAGE_TEMPLATE_PRESETS: CustomerMessageTemplatePreset[] = [
  {
    key: 'order_confirmation.whatsapp',
    name: 'ספרייה — אישור קבלת הזמנה (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.ORDER_CONFIRMATION,
    variables: ['customerName', 'orderNumber'],
    usageHint: 'מיד לאחר קליטת הזמנה או תשלום.',
    content: `שלום {{customerName}},

קיבלנו את הזמנה מס׳ {{orderNumber}} והיא בטיפול.

נעדכן בהמשך לגבי המשלוח / ההתקנה.

תודה שבחרתם בנו!`,
  },
  {
    key: 'order_confirmation.email',
    name: 'ספרייה — אישור קבלת הזמנה (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'אישור קבלת הזמנה {{orderNumber}}',
    operationalKind: OperationalMessageKind.ORDER_CONFIRMATION,
    variables: ['customerName', 'orderNumber', 'items', 'addressLine'],
    usageHint: 'אישור רשמי בדוא״ל כולל פירוט בסיסי.',
    content: `שלום {{customerName}},

קיבלנו את הזמנה מס׳ {{orderNumber}}.

פריטים:
{{items}}

כתובת למשלוח / שירות:
{{addressLine}}

נחזור אליכם במידת הצורך.

בברכה,
צוות השירות`,
  },
  {
    key: 'installation_confirmation.whatsapp',
    name: 'ספרייה — אישור מועד התקנה (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.INSTALLATION_CONFIRMATION,
    variables: ['customerName', 'orderNumber', 'installationDate', 'installationTime', 'addressLine', 'timeWindow'],
    usageHint: 'אחרי קביעת חלון התקנה או עדכון מועד.',
    content: `שלום {{customerName}},

התקנה להזמנה {{orderNumber}} אושרה.

תאריך: {{installationDate}}
שעה: {{installationTime}}
חלון: {{timeWindow}}
כתובת: {{addressLine}}

נשמח לראותכם בזמן שנקבע.`,
  },
  {
    key: 'installation_confirmation.email',
    name: 'ספרייה — אישור מועד התקנה (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'אושר מועד התקנה — הזמנה {{orderNumber}}',
    operationalKind: OperationalMessageKind.INSTALLATION_CONFIRMATION,
    variables: ['customerName', 'orderNumber', 'installationDate', 'installationTime', 'addressLine', 'timeWindow'],
    usageHint: 'אישור מסודר בדוא״ל למועד התקנה.',
    content: `שלום {{customerName}},

ההתקנה עבור הזמנה {{orderNumber}} אושרה.

פרטי המועד:
תאריך: {{installationDate}}
שעה: {{installationTime}}
חלון הגעה: {{timeWindow}}
כתובת: {{addressLine}}

אם נדרש שינוי, אנא השיבו להודעה זו.

בברכה,
צוות השירות`,
  },
  {
    key: 'installation_reminder.whatsapp',
    name: 'ספרייה — תזכורת התקנה (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.INSTALLATION_REMINDER,
    variables: ['customerName', 'orderNumber', 'installationDate', 'installationTime', 'addressLine'],
    usageHint: 'יום לפני או בבוקר יום ההתקנה.',
    content: `שלום {{customerName}},

תזכורת קצרה: מחר/היום מתוכננת התקנה להזמנה {{orderNumber}}.

מועד: {{installationDate}} בשעה {{installationTime}}
כתובת: {{addressLine}}

נשמח שתוודאו נגישות לכתובת.

תודה!`,
  },
  {
    key: 'installation_reminder.email',
    name: 'ספרייה — תזכורת התקנה (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'תזכורת: התקנה {{orderNumber}} — {{installationDate}}',
    operationalKind: OperationalMessageKind.INSTALLATION_REMINDER,
    variables: ['customerName', 'orderNumber', 'installationDate', 'installationTime', 'addressLine', 'timeWindow'],
    usageHint: 'תזכורת רשמית לפני ההתקנה.',
    content: `שלום {{customerName}},

זוהי תזכורת לגבי ההתקנה של הזמנה {{orderNumber}}.

מועד: {{installationDate}} {{installationTime}}
חלון: {{timeWindow}}
כתובת: {{addressLine}}

אם יש שינוי אחרון — עדכנו אותנו מוקדם ככל האפשר.

בברכה,
צוות השירות`,
  },
  {
    key: 'missing_details.whatsapp',
    name: 'ספרייה — בקשת השלמת פרטים (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.MISSING_DETAILS_REQUEST,
    variables: ['customerName', 'orderNumber'],
    usageHint: 'כשחסר טלפון, כתובת מדויקת או הערות גישה.',
    content: `שלום {{customerName}},

בהזמנה {{orderNumber}} חסרים לנו כמה פרטים כדי להמשיך (למשל כתובת מלאה / טלפון נוסף / קומה ודירה).

נשמח אם תשיבו בהקדם עם הפרטים.

תודה!`,
  },
  {
    key: 'missing_details.email',
    name: 'ספרייה — בקשת השלמת פרטים (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'נדרשים פרטים נוספים — הזמנה {{orderNumber}}',
    operationalKind: OperationalMessageKind.MISSING_DETAILS_REQUEST,
    variables: ['customerName', 'orderNumber', 'addressLine', 'notes'],
    usageHint: 'בקשה פורמלית להשלמת פרטי משלוח או התקנה.',
    content: `שלום {{customerName}},

לצורך טיפול בהזמנה {{orderNumber}} נדרשים מכם פרטים נוספים (כתובת מדויקת, קומה, קוד בניין, טלפון ליצירת קשר ביום האספקה וכו׳).

פרטים קיימים אצלנו:
{{addressLine}}

הערות שציינתם:
{{notes}}

נשמח לעדכון ממכם.

בברכה,
צוות השירות`,
  },
  {
    key: 'delivery_schedule.whatsapp',
    name: 'ספרייה — תיאום משלוח (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION,
    variables: ['customerName', 'orderNumber', 'deliveryScheduleSummary', 'timeWindow', 'addressLine'],
    usageHint: 'תיאום חלון משלוח או סיכום מועד שנקבע.',
    content: `שלום {{customerName}},

לגבי הזמנה {{orderNumber}} — פרטי האספקה / המשלוח:

{{deliveryScheduleSummary}}

חלון: {{timeWindow}}
כתובת: {{addressLine}}

אם משהו לא מתאים — עדכנו אותנו.

תודה!`,
  },
  {
    key: 'delivery_schedule.email',
    name: 'ספרייה — תיאום משלוח (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'תיאום משלוח — הזמנה {{orderNumber}}',
    operationalKind: OperationalMessageKind.DELIVERY_SCHEDULE_COORDINATION,
    variables: ['customerName', 'orderNumber', 'deliveryScheduleSummary', 'installationDate', 'installationTime', 'timeWindow', 'addressLine'],
    usageHint: 'הודעת תיאום מסודרת בדוא״ל.',
    content: `שלום {{customerName}},

להלן פרטי תיאום המשלוח / ההגעה עבור הזמנה {{orderNumber}}:

סיכום: {{deliveryScheduleSummary}}
תאריך: {{installationDate}}
שעה: {{installationTime}}
חלון: {{timeWindow}}
כתובת: {{addressLine}}

נא לאשר קבלה או להשיב אם נדרש שינוי.

בברכה,
צוות השירות`,
  },
  {
    key: 'custom_followup.whatsapp',
    name: 'ספרייה — מעקב כללי (WhatsApp)',
    channel: NotificationChannel.WHATSAPP,
    target: MessageTemplateTarget.CUSTOMER,
    subject: null,
    operationalKind: OperationalMessageKind.CUSTOM,
    variables: ['customerName', 'orderNumber', 'notes'],
    usageHint: 'שיחת המשך גמישה; התאימו ידנית.',
    content: `שלום {{customerName}},

פנינו בנוגע להזמנה {{orderNumber}}.

{{notes}}

נשמח לעדכון מכם.

תודה!`,
  },
  {
    key: 'custom_followup.email',
    name: 'ספרייה — מעקב כללי (אימייל)',
    channel: NotificationChannel.EMAIL,
    target: MessageTemplateTarget.CUSTOMER,
    subject: 'עדכון לגבי הזמנה {{orderNumber}}',
    operationalKind: OperationalMessageKind.CUSTOM,
    variables: ['customerName', 'orderNumber', 'items', 'addressLine', 'notes'],
    usageHint: 'מכתב כללי; התאימו נושא וגוף לפי הצורך.',
    content: `שלום {{customerName}},

כתבנו בקשר להזמנה {{orderNumber}}.

{{notes}}

פרטים רלוונטיים:
כתובת: {{addressLine}}

פריטים:
{{items}}

בברכה,
צוות השירות`,
  },
];

export function getCustomerTemplatePresetByKey(
  key: string
): CustomerMessageTemplatePreset | undefined {
  return CUSTOMER_MESSAGE_TEMPLATE_PRESETS.find((p) => p.key === key);
}

export function getCustomerTemplatePresetsByKind(
  kind: OperationalMessageKind
): CustomerMessageTemplatePreset[] {
  return CUSTOMER_MESSAGE_TEMPLATE_PRESETS.filter((p) => p.operationalKind === kind);
}
