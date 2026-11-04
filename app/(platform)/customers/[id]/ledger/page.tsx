import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function CustomerLedgerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { name: true, email: true },
  });

  if (!customer) {
    notFound();
  }

  const entries = await prisma.customerLedgerEntry.findMany({
    where: { customerId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { number: true } },
      payment: { select: { reference: true } },
    },
  });

  const formatCurrency = (cents: number) => {
    return `₪${(cents / 100).toLocaleString('he-IL')}`;
  };

  return (
    <div className="container mx-auto py-8 px-4" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <Link href="/customers" className="hover:underline">
          לקוחות
        </Link>
        <span>/</span>
        <Link href={`/customers/${params.id}`} className="hover:underline">
          {customer.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">כרטסת הנהלת חשבונות</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">כרטסת הנהלת חשבונות</h1>
          <div className="text-gray-600">
            {customer.name} {customer.email && `(${customer.email})`}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600">אין תנועות בכרטסת</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-gray-50 text-gray-700 text-sm border-b">
                  <th className="py-3 px-4">תאריך</th>
                  <th className="py-3 px-4">סוג</th>
                  <th className="py-3 px-4">תיאור</th>
                  <th className="py-3 px-4">אסמכתא</th>
                  <th className="py-3 px-4">סכום</th>
                  <th className="py-3 px-4">יתרה</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{format(entry.createdAt, 'dd/MM/yyyy HH:mm')}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          entry.type === 'PAYMENT' || entry.type === 'REFUND'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {entry.type === 'PAYMENT'
                          ? 'תשלום'
                          : entry.type === 'REFUND'
                            ? 'החזר'
                            : entry.type === 'CHARGE'
                              ? 'חיוב'
                              : entry.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">{entry.description || '-'}</td>
                    <td className="py-3 px-4">
                      {entry.order ? (
                        <Link
                          href={`/orders/${entry.orderId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {entry.order.number}
                        </Link>
                      ) : entry.payment ? (
                        <span className="font-mono text-gray-600">
                          {entry.payment.reference || '-'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 font-semibold ${
                        entry.deltaCents > 0 ? 'text-green-600' : 'text-gray-900'
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(entry.deltaCents)}
                    </td>
                    <td className="py-3 px-4 font-bold" dir="ltr">
                      {formatCurrency(entry.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
