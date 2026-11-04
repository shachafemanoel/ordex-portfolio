import { Card, CardContent } from '@/components/ui/card';

export default function OrdersLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-40 rounded bg-neutral-mute" />
        <div className="h-4 w-64 rounded bg-neutral-mute" />
      </div>

      <Card className="animate-pulse">
        <CardContent className="p-4 space-y-3">
          <div className="h-4 w-32 rounded bg-neutral-mute" />
          <div className="h-10 w-full rounded bg-surface-highlight" />
        </CardContent>
      </Card>

      <Card className="animate-pulse">
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--color-neutral-200)]">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between px-6 py-4">
                <div className="h-4 w-24 rounded bg-neutral-mute" />
                <div className="h-4 w-32 rounded bg-neutral-mute" />
                <div className="h-4 w-20 rounded bg-neutral-mute" />
                <div className="h-4 w-16 rounded bg-neutral-mute" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
