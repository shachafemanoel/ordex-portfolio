import { RouteNotFound } from '@/components/layout/fallbacks/RouteNotFound';

export default function DashboardNotFound() {
  return (
    <RouteNotFound
      title="מסך הדשבורד לא נמצא"
      description="ייתכן שהמערכת עודכנה. חזרו ללינק הראשי או התחברו מחדש."
    />
  );
}
