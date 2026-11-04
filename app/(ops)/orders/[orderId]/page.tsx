import { OrderDetailClientWrapper } from '@/app/(ops)/orders/[orderId]/OrderDetailClientWrapper';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import type { OrderWithRelations } from '@/lib/api/types';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  const service = getOrdersService();
  const order = await service.getOrderById(params.orderId);

  if (!order) {
    notFound();
  }

  const serializedOrder = JSON.parse(JSON.stringify(order)) as OrderWithRelations;

  return (
    <section className="animate-in fade-in duration-300">
      <OrderDetailClientWrapper initialOrder={serializedOrder} />
    </section>
  );
}
