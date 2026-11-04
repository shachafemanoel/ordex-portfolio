import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrdersStatusRedirectPage(props: {
  params: Promise<{ status: string }>;
}) {
  const { status } = await props.params;
  const normalized = status?.toUpperCase() || 'ALL';
  redirect(`/orders?status=${encodeURIComponent(normalized)}`);
}
