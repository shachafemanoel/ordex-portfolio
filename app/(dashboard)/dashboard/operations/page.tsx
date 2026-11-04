import { RequireRoleGate } from '@/components/layout/RequireRoleGate';
import { DeliveryOperationsHub } from '@/components/operations/DeliveryOperationsHub';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { getOperationsDashboardData } from '@/lib/services/dashboard/OperationsDashboardService';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['ADMIN', 'OPERATIONS'];

function OperationsHubFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] border border-[#f2ece8] bg-[#fffdfb] p-8 text-sm font-semibold text-[#75665d]">
      טוען לוח משלוחים…
    </div>
  );
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    redirect('/forbidden');
  }

  const { date: dateParam } = await searchParams;
  const date = dateParam ? new Date(dateParam) : new Date();
  const data = await getOperationsDashboardData(date);

  return (
    <RequireRoleGate allowedRoles={ALLOWED_ROLES}>
      <Suspense fallback={<OperationsHubFallback />}>
        <DeliveryOperationsHub data={data} />
      </Suspense>
    </RequireRoleGate>
  );
}
