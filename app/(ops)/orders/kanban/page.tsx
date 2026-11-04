import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy Kanban page — consolidated into /orders.
 */
export default function OrdersKanbanPage() {
  redirect('/orders');
}
