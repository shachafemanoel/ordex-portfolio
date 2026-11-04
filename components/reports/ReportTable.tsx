import Link from 'next/link';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

type ColumnType = 'number' | 'customer' | 'address' | 'amount' | 'status' | 'created' | 'install';

interface ReportTableProps {
  orders: Order[];
  loading?: boolean;
  columns?: Array<ColumnType>;
  // Some pages pass this to hide pagination; table has no pagination UI, so accept and ignore
  showPagination?: boolean;
}

const defaultColumns: Array<ColumnType> = [
  'number',
  'customer',
  'address',
  'amount',
  'status',
  'created',
];

export function ReportTable({
  orders,
  loading = false,
  columns = defaultColumns,
}: ReportTableProps) {
  const cols = columns ?? defaultColumns;
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-8 text-center">
          <div className="inline-flex items-center space-x-2 space-x-reverse">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">טוען נתונים...</span>
          </div>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-2">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">אין נתונים</h3>
          <p className="text-gray-500">לא נמצאו הזמנות התואמות לקריטריונים שנבחרו</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.includes('number') && <TableHead>מספר הזמנה</TableHead>}
            {cols.includes('customer') && <TableHead>לקוח</TableHead>}
            {cols.includes('address') && <TableHead>כתובת</TableHead>}
            {cols.includes('amount') && <TableHead>סכום</TableHead>}
            {cols.includes('status') && <TableHead>סטטוס</TableHead>}
            {cols.includes('created') && <TableHead>תאריך יצירה</TableHead>}
            {cols.includes('install') && <TableHead>תאריך התקנה</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              {cols.includes('number') && (
                <TableCell className="font-medium">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    #{order.number}
                  </Link>
                </TableCell>
              )}
              {cols.includes('customer') && (
                <TableCell>
                  <div>
                    <div className="font-medium text-gray-900">{order.customerName}</div>
                    {order.customerPhone && (
                      <div className="text-sm text-gray-500">{order.customerPhone}</div>
                    )}
                  </div>
                </TableCell>
              )}
              {cols.includes('address') && (
                <TableCell>
                  <div className="text-sm">
                    <div>{order.address}</div>
                    {order.city && <div className="text-gray-500">{order.city}</div>}
                  </div>
                </TableCell>
              )}
              {cols.includes('amount') && (
                <TableCell className="font-medium">
                  {formatCurrency(order.totalAmount ?? 0)}
                </TableCell>
              )}
              {cols.includes('status') && (
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
              )}
              {cols.includes('created') && (
                <TableCell className="text-gray-500">{formatDate(order.createdAt)}</TableCell>
              )}
              {cols.includes('install') && (
                <TableCell className="text-gray-500">
                  {order.installAt ? formatDate(order.installAt) : '-'}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
