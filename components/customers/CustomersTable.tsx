'use client';

import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { DataTable } from '@/components/ui/data-table/DataTable';
import { Column } from '@/components/ui/data-table/types';
import { formatCurrencyCents } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const columns: Column<any>[] = [
  {
    key: 'avatar',
    title: '',
    width: '72px',
    render: (_, row) => {
      const name = row.name || 'לקוח';
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
    key: 'name',
    title: 'שם לקוח',
    render: (value) => (
      <span className="font-semibold text-gray-900">{value || DISPLAY_TEXT.unknownCustomer}</span>
    ),
    sortable: true,
  },
  {
    key: 'email',
    title: 'אימייל',
    render: (value) => <span className="text-gray-600">{value || '-'}</span>,
    sortable: true,
  },
  {
    key: 'phone',
    title: 'טלפון',
    render: (value) => (
      <span className="text-gray-600" dir="ltr">
        {value || '-'}
      </span>
    ),
  },
  {
    key: 'ordersCount',
    title: 'הזמנות',
    render: (value) => <span className="text-gray-700 font-semibold">{Number(value) || 0}</span>,
    sortable: true,
  },
  {
    key: 'currentBalanceCents',
    title: 'מאזן',
    render: (value) => {
      const cents = Number(value) || 0;
      return (
        <span
          className={`font-bold ${cents > 0 ? 'text-danger-700' : cents < 0 ? 'text-success-700' : 'text-gray-700'}`}
          dir="ltr"
        >
          {formatCurrencyCents(cents)}
        </span>
      );
    },
    sortable: true,
  },
];

interface CustomersTableProps {
  customers: any[];
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const router = useRouter();

  return (
    <DataTable
      data={customers}
      columns={columns}
      sortable={true}
      filterable={true}
      globalSearch={false} // Page has its own search possibly, but customer page seems simple.
      pagination={{
        currentPage: 1,
        totalPages: 1,
        pageSize: 100,
        totalItems: customers.length,
        onPageChange: () => {},
      }}
      onRowClick={(customer) => router.push(`/customers/${customer.id}`)}
      emptyMessage="לא נמצאו לקוחות"
    />
  );
}
