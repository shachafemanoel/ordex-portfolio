import { Card, CardContent } from '@/components/ui/card';

export default function CustomerDetailsLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-20 rounded bg-gray-100" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          {[0, 1].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-4 w-full rounded bg-gray-100" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
