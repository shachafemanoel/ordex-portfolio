/**
 * טיפוסים למדדי דשבורד
 * משמש לניתוח AI ולתצוגת נתונים
 */

/**
 * מדדי דשבורד מלאים מבסיס הנתונים
 */
export interface DashboardMetrics {
  // מדדים כלליים
  totalRevenue: number;           // הכנסה כוללת החודש (בשקלים)
  totalOrders: number;            // סה"כ הזמנות החודש
  avgOrderValue: number;          // ממוצע להזמנה
  activeCustomers: number;        // לקוחות פעילים החודש

  // פילוח הזמנות לפי סטטוס
  ordersByStatus: Record<string, number>;

  // מלאי ומוצרים
  productsInStock: number;        // מוצרים זמינים
  productsOutOfStock: number;     // מוצרים חסרים
  productsLowStock: number;       // מוצרים בסף מלאי נמוך

  // ספקים ורכש
  openPurchaseOrders: number;     // הזמנות רכש פתוחות
  purchaseOrdersValue: number;    // ערך הזמנות רכש פתוחות
  overduePurchaseOrders: number;  // הזמנות רכש שעברו תאריך

  // ביצועים תפעוליים
  onTimeDeliveryRate: number;     // אחוז משלוחים בזמן (0-100)
  avgOrderProcessingTime: number; // ימים ממוצעים לטיפול
  ordersWaitingForStock: number;  // הזמנות ממתינות למלאי
  ordersWaitingForInstallation: number; // הזמנות ממתינות להתקנה

  // פיננסים
  dso: number;                    // Days Sales Outstanding
  pendingPayments: number;        // מספר חשבונות ממתינים
  pendingPaymentsValue: number;   // ערך חשבונות ממתינים

  // אירועים אחרונים (24 שעות)
  recentEvents: RecentEvent[];
}

/**
 * אירוע אחרון במערכת
 */
export interface RecentEvent {
  type: 'order_created' | 'order_completed' | 'payment_received' | 'stock_alert' | 'customer_complaint';
  description: string;
  timestamp: Date;
  severity?: 'info' | 'warning' | 'error';
  relatedEntityId?: string; // Order ID, Customer ID, etc.
}

/**
 * פילטרים לשליפת מדדים
 */
export interface DashboardMetricsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  includeInactive?: boolean;
}

/**
 * סטטיסטיקות מתקדמות (אופציונלי)
 */
export interface AdvancedMetrics {
  // מגמות (השוואה לחודש קודם)
  revenueGrowth: number;          // % שינוי בהכנסות
  ordersGrowth: number;           // % שינוי בהזמנות
  customerGrowth: number;         // % שינוי בלקוחות

  // Top performers
  topProducts: Array<{ sku: string; name: string; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; clv: number }>;
  topCities: Array<{ city: string; ordersCount: number }>;

  // Bottlenecks
  slowestProcessSteps: Array<{ step: string; avgDays: number }>;
}
