'use client';

import { CustomerIdentityCard } from '@/components/shared/CustomerIdentityCard';
import { EntityActionLink, EntityBadge, EntityField, EntitySurface } from '@/components/shared/display/EntityPrimitives';
import { getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import { DISPLAY_TEXT } from '@/components/shared/display/displayText';
import { formatDisplayAddress, formatDisplayPhoneHref, formatDisplayTime } from '@/components/shared/display/displayFormatters';
import { getStatusLabel } from '@/lib/orderStatus';
import { Calendar, MessageCircle, Phone } from 'lucide-react';

interface OrderSummaryProps {
  order: {
    number: string;
    customerName: string | null;
    customerPhone?: string | null;
    addressLine?: string | null;
    scheduledAt?: string | Date | null;
    notes?: string | null;
    status: string;
  };
}

export function OrderSummary({ order }: OrderSummaryProps) {
  const statusDisplay = getOrderStatusDisplay(order.status);
  const contactHref = formatDisplayPhoneHref(order.customerPhone);

  return (
    <EntitySurface className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">#{order.number}</h3>
        <EntityBadge label={statusDisplay.label ?? getStatusLabel(order.status as any)} tone={statusDisplay.tone} />
      </div>

      <CustomerIdentityCard
        name={order.customerName}
        phone={order.customerPhone}
        className="bg-white/90 shadow-none"
      />

      <div className="mt-3 grid gap-2">
        <EntityField label={DISPLAY_TEXT.address} value={formatDisplayAddress(order.addressLine)} tone="neutral" />
        <EntityField
          icon={Calendar}
          label={DISPLAY_TEXT.schedule}
          value={formatDisplayTime(order.scheduledAt) ?? DISPLAY_TEXT.noSchedule}
          tone="info"
        />
        {order.notes ? (
          <EntityField label={DISPLAY_TEXT.notes} value={order.notes} tone="warning" />
        ) : null}
      </div>

      {contactHref ? (
        <div className="mt-3 flex items-center gap-2">
          <EntityActionLink href={`https://wa.me/${order.customerPhone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" tone="secondary">
            <MessageCircle className="h-4 w-4" />
          </EntityActionLink>
          <EntityActionLink href={contactHref} tone="secondary">
            <Phone className="h-4 w-4" />
          </EntityActionLink>
        </div>
      ) : null}
    </EntitySurface>
  );
}
