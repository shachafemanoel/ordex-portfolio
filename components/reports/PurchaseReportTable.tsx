import { PurchaseReportItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

export function PurchaseReportTable({
  items,
  loading = false,
}: {
  items: PurchaseReportItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="inline-flex items-center space-x-2 space-x-reverse">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">טוען נתונים...</span>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        אין נתונים להצגה
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ספק</TableHead>
            <TableHead>קוד מוצר</TableHead>
            <TableHead>שם מוצר</TableHead>
            <TableHead>כמות כוללת</TableHead>
            <TableHead>כמות שהתקבלה</TableHead>
            <TableHead>כמות ממתינה</TableHead>
            <TableHead>מס׳ הזמנות</TableHead>
            <TableHead>שווי מוערך</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.supplierId}-${item.productId}`}>
              <TableCell>{item.supplierName}</TableCell>
              <TableCell>{item.skuCode}</TableCell>
              <TableCell>{item.skuName}</TableCell>
              <TableCell>{item.totalQty}</TableCell>
              <TableCell>{item.receivedQty}</TableCell>
              <TableCell>{item.pendingQty}</TableCell>
              <TableCell>{item.orderNumbers.length}</TableCell>
              <TableCell>{formatCurrency(item.estimatedValue || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
