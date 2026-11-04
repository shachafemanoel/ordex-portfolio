/**
 * OrderPriorityBadge Component Examples
 *
 * This file demonstrates all the ways to use the OrderPriorityBadge and OrderPriorityMark components.
 * Copy these examples into your components where you need priority indicators.
 */

import { OrderPriorityBadge, OrderPriorityMark } from '@/components/orders/shared/OrderPriorityBadge';

/**
 * Example 1: Default Badges (all priorities)
 */
export function PriorityBadgesExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">דוגמאות תגיות עדיפות</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityBadge priority="LOW" />
        <OrderPriorityBadge priority="MEDIUM" />
        <OrderPriorityBadge priority="HIGH" />
      </div>
    </div>
  );
}

/**
 * Example 2: Different Sizes
 */
export function PrioritySizesExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">גדלים שונים</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityBadge priority="HIGH" size="sm" />
        <OrderPriorityBadge priority="HIGH" size="md" />
        <OrderPriorityBadge priority="HIGH" size="lg" />
      </div>
    </div>
  );
}

/**
 * Example 3: Icon Only (compact)
 */
export function PriorityIconOnlyExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">אייקון בלבד (מצב קומפקטי)</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityBadge priority="LOW" showLabel={false} />
        <OrderPriorityBadge priority="MEDIUM" showLabel={false} />
        <OrderPriorityBadge priority="HIGH" showLabel={false} />
      </div>
    </div>
  );
}

/**
 * Example 4: Label Only (no icon)
 */
export function PriorityLabelOnlyExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">טקסט בלבד (ללא אייקון)</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityBadge priority="LOW" showIcon={false} />
        <OrderPriorityBadge priority="MEDIUM" showIcon={false} />
        <OrderPriorityBadge priority="HIGH" showIcon={false} />
      </div>
    </div>
  );
}

/**
 * Example 5: Priority Marks (circular indicators)
 */
export function PriorityMarksExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">סימני עדיפות (עיגולים)</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityMark priority="LOW" />
        <OrderPriorityMark priority="MEDIUM" />
        <OrderPriorityMark priority="HIGH" />
      </div>
    </div>
  );
}

/**
 * Example 6: Priority Marks - Different Sizes
 */
export function PriorityMarksSizesExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">סימני עדיפות - גדלים</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <OrderPriorityMark priority="HIGH" size="sm" />
        <OrderPriorityMark priority="HIGH" size="md" />
        <OrderPriorityMark priority="HIGH" size="lg" />
      </div>
    </div>
  );
}

/**
 * Example 7: In a Table Context
 */
export function PriorityInTableExample() {
  const orders = [
    { id: '1', customer: 'דני כהן', priority: 'HIGH' as const },
    { id: '2', customer: 'שרה לוי', priority: 'MEDIUM' as const },
    { id: '3', customer: 'יוסי אברהם', priority: 'LOW' as const },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">שימוש בטבלה</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-right p-2">מזהה</th>
            <th className="text-right p-2">לקוח</th>
            <th className="text-right p-2">עדיפות</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b hover:bg-slate-50">
              <td className="p-2">{order.id}</td>
              <td className="p-2">{order.customer}</td>
              <td className="p-2">
                <OrderPriorityBadge priority={order.priority} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Example 8: In a Card/List Context
 */
export function PriorityInCardExample() {
  const orders = [
    { id: '1234', customer: 'דני כהן', priority: 'HIGH' as const, status: 'ממתין לטיפול' },
    { id: '1235', customer: 'שרה לוי', priority: 'MEDIUM' as const, status: 'בתהליך' },
    { id: '1236', customer: 'יוסי אברהם', priority: 'LOW' as const, status: 'הושלם' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">שימוש בכרטיסים</h3>
      <div className="space-y-2">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">הזמנה #{order.id}</span>
                <OrderPriorityBadge priority={order.priority} size="sm" />
              </div>
              <p className="text-sm text-slate-600">
                {order.customer} • {order.status}
              </p>
            </div>
            <OrderPriorityMark priority={order.priority} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example 9: Minimal Dot Indicators (for tight spaces)
 */
export function PriorityDotsExample() {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">נקודות מינימליות (מקום מוגבל)</h3>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <OrderPriorityBadge priority="LOW" showIcon={false} showLabel={false} />
          <span className="text-sm">נמוכה</span>
        </div>
        <div className="flex items-center gap-2">
          <OrderPriorityBadge priority="MEDIUM" showIcon={false} showLabel={false} />
          <span className="text-sm">בינונית</span>
        </div>
        <div className="flex items-center gap-2">
          <OrderPriorityBadge priority="HIGH" showIcon={false} showLabel={false} />
          <span className="text-sm">גבוהה</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Complete Demo Page
 */
export default function OrderPriorityBadgeShowcase() {
  return (
    <div className="container mx-auto p-8 space-y-12 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">מערכת סימוני עדיפות הזמנות</h1>
        <p className="text-slate-600">
          רכיבים גמישים להצגת עדיפות הזמנות במגוון הקשרים
        </p>
      </div>

      <div className="grid gap-8">
        <PriorityBadgesExample />
        <PrioritySizesExample />
        <PriorityIconOnlyExample />
        <PriorityLabelOnlyExample />
        <PriorityMarksExample />
        <PriorityMarksSizesExample />
        <PriorityInTableExample />
        <PriorityInCardExample />
        <PriorityDotsExample />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-blue-900">הוראות שימוש</h3>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
          <li>השתמש ב-<code className="bg-blue-100 px-1 rounded">OrderPriorityBadge</code> לתצוגה מלאה עם טקסט</li>
          <li>השתמש ב-<code className="bg-blue-100 px-1 rounded">OrderPriorityMark</code> לאינדיקטור עיגולי קומפקטי</li>
          <li>התאם את ה-<code className="bg-blue-100 px-1 rounded">size</code> בהתאם להקשר: sm לטבלאות, md לכרטיסים, lg לכותרות</li>
          <li>השתמש ב-<code className="bg-blue-100 px-1 rounded">showIcon</code> ו-<code className="bg-blue-100 px-1 rounded">showLabel</code> לשליטה מלאה בתצוגה</li>
        </ul>
      </div>
    </div>
  );
}
