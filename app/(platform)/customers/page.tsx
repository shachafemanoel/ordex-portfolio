import { CustomerListCard } from '@/components/customers/CustomerListCard';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/card';
import { getCustomersService } from '@/lib/services/ServiceFactory';
import { ListPageTemplate } from '@/components/layout/ListPageTemplate';
import { Plus, Search, UserCheck, Users, X } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CustomersPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const service = getCustomersService();

  const { items: customers, pagination } = await service.listCustomers(
    { q: searchParams.q },
    { page: 1, perPage: 100 }
  );

  const totalCustomers = pagination?.total || customers.length;
  const activeCustomers = customers.filter((c: any) => !c.isArchived).length;

  return (
    <ListPageTemplate
      title="לקוחות"
      description="ניהול מאגר הלקוחות ופרטי התקשרות"
      headerActions={
        <Link href="/customers/new">
          <Button className="gap-2">
            <Plus className="w-5 h-5" />
            לקוח חדש
          </Button>
        </Link>
      }
      className="h-full"
    >
      <div className="space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="סה״כ לקוחות" value={totalCustomers} icon={Users} variant="primary" />
          <StatCard
            title="לקוחות פעילים"
            value={activeCustomers}
            icon={UserCheck}
            variant="success"
          />
        </div>

        {/* Search */}
        <Card className="p-4 bg-white border border-gray-100 shadow-sm">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="q"
                placeholder="חיפוש לפי שם, טלפון או אימייל"
                defaultValue={searchParams.q}
                className="pr-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                חיפוש
              </Button>
              {searchParams.q && (
                <Link href="/customers">
                  <Button type="button" variant="ghost" size="icon">
                    <X className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </Card>

        {/* Customer Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((customer: any) => (
            <CustomerListCard key={customer.id} customer={customer} />
          ))}
        </div>

        {customers.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-gray-400">
            לא נמצאו לקוחות
          </div>
        )}
      </div>
    </ListPageTemplate>
  );
}
