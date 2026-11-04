import { redirect } from 'next/navigation';

export default function OrdersMapPage() {
  redirect('/orders?view=map');
}
