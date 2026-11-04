import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyDeliveriesRoute() {
  redirect('/deliveries');
}
