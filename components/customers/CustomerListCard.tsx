'use client';

import { CustomerIdentityCard } from '@/components/shared/CustomerIdentityCard';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { QuickActions } from '@/components/shared/QuickActions';
import { cn, formatCurrencyCents } from '@/lib/utils';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface CustomerListCardProps {
  customer: any;
}

export function CustomerListCard({ customer }: CustomerListCardProps) {
  const name = customer.name || DISPLAY_TEXT.unknownCustomer;
  const phone = customer.phone;
  const email = customer.email;
  const ordersCount = Number(customer.ordersCount) || 0;
  const balanceCents = Number(customer.currentBalanceCents) || 0;

  return (
    <CustomerIdentityCard
      name={name}
      phone={phone}
      email={email}
      href={`/customers/${customer.id}`}
      className="group/card relative overflow-hidden border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
      meta={
        <div className="relative z-10">
          <span
            className={cn(
              'text-sm font-bold',
              balanceCents !== 0 ? 'text-red-600' : 'text-slate-500'
            )}
            dir="ltr"
          >
            {formatCurrencyCents(balanceCents)}
          </span>
          <div className="mt-0.5 text-[10px] text-slate-400">
            {ordersCount === 0
              ? 'אין הזמנות'
              : ordersCount === 1
              ? 'הזמנה אחת'
              : `${ordersCount} הזמנות`}
          </div>
        </div>
      }
      footer={
        <div className="relative z-10 flex items-center justify-between gap-3">
          <QuickActions phoneNumber={phone} detailsLink={`/customers/${customer.id}`} size="sm" />

          <Link
            href={`/orders/new?customerId=${customer.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-600 transition-colors hover:bg-primary-100 hover:text-primary-700"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            הזמנה חדשה
          </Link>
        </div>
      }
    />
  );
}
