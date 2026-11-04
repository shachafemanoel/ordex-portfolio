import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrderEditRedirectPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  redirect(`/orders/${orderId}`);
}
