import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy overview page — consolidated into /orders.
 */
export default function OrdersOverviewPage() {
  redirect('/orders');
}
