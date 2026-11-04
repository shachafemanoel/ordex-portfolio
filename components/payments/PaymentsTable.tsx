'use client';

import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { Column } from '@/components/ui/data-table/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

const columns: Column<any>[] = [
  {
    key: 'avatar',
    title: '',
    width: '72px',
    render: (_value, row) => {
      const name = row.customer?.name || 'לקוח';
      const initial = name.trim().charAt(0) || 'ל';
      return (
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 text-primary-700 border border-primary-100 flex items-center justify-center text-sm font-bold">
            {initial}
          </div>
        </div>
      );
    },
  },
  {
    key: 'createdAt',
    title: 'תאריך',
    render: (value) => (
      <span className="text-gray-500 text-[13px]">
        {format(new Date(value), 'd בMMM, yyyy', { locale: he })}
      </span>
    ),
    sortable: true,
  },
  {
    key: 'order',
    title: 'הזמנה',
    render: (value) =>
      value ? <span className="font-semibold text-primary-700">#{value.number}</span> : '-',
    sortable: true,
  },
  {
    key: 'customer',
    title: 'לקוח',
    render: (value) => (
      <span className="font-semibold text-gray-900">{value?.name || DISPLAY_TEXT.unknownCustomer}</span>
    ),
    sortable: true,
  },
  {
    key: 'amount',
    title: 'סכום',
    render: (value) => (
      <span className="font-bold text-gray-900 text-[15px]">
        {formatCurrency(Number(value || 0))}
      </span>
    ),
    sortable: true,
  },
  {
    key: 'method',
    title: 'אמצעי תשלום',
    render: (value) => <span className="text-gray-600">{value}</span>,
    sortable: true,
  },
  {
    key: 'reference',
    title: 'אסמכתא',
    render: (value) => <span className="font-mono text-xs text-gray-500">{value || '-'}</span>,
  },
  {
    key: 'status',
    title: 'סטטוס',
    render: (value) => <StatusBadge status={value} size="sm" />,
    sortable: true,
  },
];

interface PaymentsTableProps {
  payments: any[];
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const router = useRouter();

  return (
    <DataTable
      data={payments}
      columns={columns}
      sortable={true}
      filterable={true}
      globalSearch={true}
      pagination={{
        currentPage: 1,
        totalPages: 1,
        pageSize: 50,
        totalItems: payments.length,
        onPageChange: () => {},
      }}
      // Payments usually don't have a detail page, or do they?
      // If there is no payment detail page, we might just link to order or do nothing.
      // I'll assume for now we might want to go to order or payment detail.
      // If no ID nav, remove onRowClick. The user prompt said "correct row click navigation".
      // Let's assume there is a /payments/[id] or just link to order.
      // Since I don't know if /payments/[id] exists, I'll link to order if present in data, else do nothing?
      // Or just navigate to /payments/[id] and if it 404s that's a separate issue (but standard practice).
      // However, looking at the previous file content (if I had it), I would know.
      // I'll check the page content first before finalizing this file.
      emptyMessage="לא נמצאו תשלומים"
    />
  );
}
