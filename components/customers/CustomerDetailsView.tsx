import { CustomerIdentityCard } from '@/components/shared/CustomerIdentityCard';
import { EntityNotice } from '@/components/shared/display/EntityPrimitives';
import { DetailsPageTemplate } from '@/components/layout/DetailsPageTemplate';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrencyCents } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const addressTypeLabel = {
  BILLING: 'כתובת חיוב',
  SHIPPING: 'כתובת משלוח',
};

export interface CustomerDetailsAddress {
  id: string;
  type: string;
  city: string;
  street: string;
  number: string;
  floor?: string | null;
  notes?: string | null;
}

export interface CustomerDetailsOrder {
  id: string;
  number: string;
  status: string;
  totalCents?: number | null;
  createdAt: Date;
}

export interface CustomerDetailsData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  segment?: string | null;
  lifecycle: string;
  riskLevel: string;
  currentBalanceCents?: number | null;
  lastActivityAt?: Date | null;
  accountNotes?: string | null;
  accountManagerId?: string | null;
  addresses: CustomerDetailsAddress[];
  orders: CustomerDetailsOrder[];
}

interface CustomerSummaryCardProps {
  customer: CustomerDetailsData;
  customerId: string;
}

function CustomerSummaryCard({ customer, customerId }: CustomerSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">תקציר לקוח</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerIdentityCard
          name={customer.name}
          phone={customer.phone}
          email={customer.email}
          href={`/customers/${customerId}`}
          className="mb-4 border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]"
          meta={
            <div className="rounded-full border border-[var(--color-border-primary)] bg-[var(--card-bg)] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[var(--color-text-secondary)]">
              {customer.segment || 'לקוח פעיל'}
            </div>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="surface-subtle p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">מחזור חיי לקוח</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
              {customer.lifecycle}
            </p>
          </div>
          <div className="surface-subtle p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">רמת סיכון</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
              {customer.riskLevel}
            </p>
          </div>
          <div className="surface-subtle p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">יתרת חשבון</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]" dir="ltr">
              {formatCurrencyCents(customer.currentBalanceCents)}
            </p>
          </div>
          <div className="surface-subtle p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">הזמנה אחרונה</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
              {customer.lastActivityAt
                ? format(new Date(customer.lastActivityAt), 'd בMMM, yyyy', { locale: he })
                : 'אין פעילות אחרונה'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomerRecentOrdersCardProps {
  customer: CustomerDetailsData;
  customerId: string;
}

function CustomerRecentOrdersCard({ customer, customerId }: CustomerRecentOrdersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">הזמנות אחרונות</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {customer.orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--color-text-secondary)]">
            אין הזמנות ללקוח זה עדיין.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-primary)]">
            {customer.orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}?from=customers&customerId=${customerId}&customerName=${encodeURIComponent(customer.name)}`}
                className="flex flex-col gap-2 px-6 py-4 transition hover:bg-[var(--color-bg-secondary)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">הזמנה #{order.number}</div>
                  <div className="text-base font-semibold text-[var(--color-text-primary)]">
                    {format(new Date(order.createdAt), 'd בMMM, yyyy', { locale: he })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} size="sm" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]" dir="ltr">
                    {formatCurrencyCents(order.totalCents)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CustomerContactCardProps {
  customer: CustomerDetailsData;
}

function CustomerContactCard({ customer }: CustomerContactCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">פרטי קשר</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-[var(--color-text-secondary)]">איש קשר ראשי</p>
          <p className="font-semibold text-[var(--color-text-primary)]">{customer.name}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-secondary)]">אימייל</p>
          <p className="font-semibold text-[var(--color-text-primary)]">{customer.email || 'לא זמין'}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-secondary)]">טלפון</p>
          <p className="font-semibold text-[var(--color-text-primary)]">{customer.phone || 'לא זמין'}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-secondary)]">מנהל לקוח</p>
          <p className="font-semibold text-[var(--color-text-primary)]">
            {customer.accountManagerId ? 'משויך במערכת' : 'לא משויך'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomerAddressesCardProps {
  addresses: CustomerDetailsAddress[];
}

function CustomerAddressesCard({ addresses }: CustomerAddressesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">כתובות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {addresses.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">לא הוגדרו כתובות ללקוח זה.</p>
        ) : (
          addresses.map((address) => (
            <div key={address.id} className="surface-subtle p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">
                {addressTypeLabel[address.type as keyof typeof addressTypeLabel] ?? address.type}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {address.street} {address.number}, {address.city}
              </p>
              {address.floor ? (
                <p className="text-xs text-[var(--color-text-secondary)]">קומה {address.floor}</p>
              ) : null}
              {address.notes ? (
                <p className="text-xs text-[var(--color-text-secondary)]">{address.notes}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface CustomerDetailsViewProps {
  customer: CustomerDetailsData;
}

export function CustomerDetailsView({ customer }: CustomerDetailsViewProps) {
  const addresses = customer.addresses.length ? customer.addresses : [];

  return (
    <DetailsPageTemplate
      title={customer.name}
      subtitle={customer.email || customer.phone || 'פרטי לקוח'}
      description={customer.segment ? `סגמנט: ${customer.segment}` : undefined}
      breadcrumbs={[{ label: 'לקוחות', href: '/customers' }, { label: customer.name }]}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/customers/${customer.id}/ledger`}>כרטסת הנהלת חשבונות</Link>
          </Button>
          <Button asChild>
            <Link href={`/orders/new?customerId=${customer.id}`}>הזמנה חדשה</Link>
          </Button>
        </div>
      }
    >
      {customer.accountNotes ? (
        <div className="mb-6">
          <EntityNotice
            icon={AlertCircle}
            tone="warning"
            title="הערות CRM (בולטות)"
            description={customer.accountNotes}
            className="border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)] shadow-[var(--shadow-sm)]"
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CustomerSummaryCard customer={customer} customerId={customer.id} />
          <CustomerRecentOrdersCard customer={customer} customerId={customer.id} />
        </div>

        <div className="space-y-6">
          <CustomerContactCard customer={customer} />
          <CustomerAddressesCard addresses={addresses} />
        </div>
      </div>
    </DetailsPageTemplate>
  );
}
