import { DetailsPageTemplate } from '@/components/layout/DetailsPageTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { InventoryService } from '@/lib/inventory';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InventoryOverviewPage() {
  const [lowStockItems, activeCount, outOfStockCount] = await Promise.all([
    InventoryService.getLowStockProducts(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, stock: 0 } }),
  ]);

  const lowButNotOut = lowStockItems.filter((p) => p.currentStock > 0).length;

  return (
    <DetailsPageTemplate
      title="מלאי"
      subtitle="סיכום מצב מלאי מול רמת הזמנה מחדש"
      breadcrumbs={[{ label: 'מלאי' }]}
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-right text-base">פריטים פעילים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className={outOfStockCount > 0 ? 'border-red-200 bg-red-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-right text-base">אזל מהמלאי</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-red-700">{outOfStockCount}</p>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? 'border-amber-200 bg-amber-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-right text-base">מתחת לסף הזמנה</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-amber-800">
              {lowStockItems.length}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              מתוכם {lowButNotOut} עם מלאי &gt; 0 ועדיין ≤ רמת הזמנה
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-right">פריטים הדורשים תשומת לב</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lowStockItems.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              אין פריטים מתחת לסף ההזמנה מחדש.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 overflow-x-auto">
              <table className="w-full min-w-[640px] text-right text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                    <th className="px-4 py-3 font-medium">מק״ט</th>
                    <th className="px-4 py-3 font-medium">שם</th>
                    <th className="px-4 py-3 font-medium">במלאי</th>
                    <th className="px-4 py-3 font-medium">סף הזמנה</th>
                    <th className="px-4 py-3 font-medium">חוסר</th>
                    <th className="px-4 py-3 font-medium">ספק</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((row) => (
                    <tr key={row.productId} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                        {row.sku}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href="/products"
                          className="font-medium text-amber-800 underline-offset-2 hover:underline"
                        >
                          {row.productName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{row.currentStock}</td>
                      <td className="px-4 py-3 tabular-nums">{row.reorderLevel}</td>
                      <td className="px-4 py-3 tabular-nums text-amber-800">
                        {row.stockDeficit}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.supplierName ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DetailsPageTemplate>
  );
}
