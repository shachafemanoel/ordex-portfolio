import { RouteNotFound } from '@/components/layout/fallbacks/RouteNotFound';

export default function OrdersNotFound() {
  return (
    <RouteNotFound
      title="לא מצאנו את מסך ההזמנות"
      description="ייתכן שהקישור שגוי או שההזמנות הועברו. חזרו לדשבורד כדי לבחור מודול מחדש."
    />
  );
}
