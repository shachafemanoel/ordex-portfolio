export function InstallationsDashboard() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">דשבורד התקנות</h1>
      <p className="mt-2 text-sm text-gray-500">
        מודול ההתקנות הוחזר במצב תאימות. ניהול השיבוצים הפעיל זמין דרך מסכי התפעול.
      </p>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        עבור שיבוץ ותפעול בזמן אמת, עבור ל־`/dashboard/operations` או למסך היומן.
      </div>
    </div>
  );
}
