'use client';

/**
 * Custom Skeleton Components
 *
 * Skeletons מותאמים אישית לכל סוג של widget במערכת
 * כל skeleton תומך ב-accessibility (aria-label, role="status")
 */

import { Card, CardContent } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/Loading';

/**
 * Orders Table Skeleton
 * משמש בעמוד ההזמנות הראשי
 */
export function OrdersTableSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="טוען הזמנות">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="mb-3 h-3 w-3/4 rounded-full bg-gray-200" />
              <div className="mb-2 h-6 w-1/2 rounded-full bg-gray-200" />
              <div className="h-3 w-1/4 rounded-full bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardContent className="p-4">
          <SkeletonTable rows={10} columns={7} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Dashboard Skeleton
 * משמש בדשבורד הראשי - Enhanced version matching RealTimeDashboardWrapper
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="טוען לוח בקרה">
      {/* Hero Overview: Map + Pipeline Skeleton */}
      <Card className="animate-pulse overflow-hidden">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-2 gap-0">
            {/* Map Placeholder */}
            <div className="h-[400px] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-300 mx-auto" />
                <div className="h-3 w-32 rounded bg-slate-300 mx-auto" />
              </div>
            </div>

            {/* Pipeline Placeholder */}
            <div className="p-6 space-y-4">
              <div className="h-6 w-48 rounded bg-gray-200" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200" />
                    <div className="h-3 w-24 rounded bg-gray-200" />
                  </div>
                  <div className="h-8 w-16 rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Bar Skeleton */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse">
        <div className="h-3 w-24 rounded bg-gray-200" />
        <div className="h-10 w-32 rounded-lg bg-gray-200" />
        <div className="h-10 w-40 rounded-lg bg-gray-200" />
        <div className="h-10 w-32 rounded-lg bg-gray-200" />
        <div className="h-10 w-36 rounded-lg bg-gray-200" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Dashboard Content (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Central Info Widget Skeleton */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-10 w-48 rounded bg-gray-200" />
                  <div className="h-3 w-56 rounded bg-gray-200" />
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              </div>

              {/* Progress Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="h-3 w-16 rounded bg-gray-200" />
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200" />
                <div className="flex justify-between gap-4">
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="h-3 w-20 rounded bg-gray-200" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Tile Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-28 rounded bg-gray-200" />
                      <div className="h-8 w-16 rounded bg-gray-200" />
                      <div className="h-3 w-36 rounded bg-gray-200" />
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-gray-200" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mini Analytics Skeleton */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-32 rounded bg-gray-200" />
                <div className="h-6 w-20 rounded-full bg-gray-200" />
              </div>
              <div className="h-48 rounded bg-gradient-to-t from-slate-100 to-slate-50" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-6 w-32 rounded bg-gray-200" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-6 w-32 rounded bg-gray-200" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Action Required Widget Skeleton */}
          <Card className="animate-pulse">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="h-5 w-28 rounded bg-gray-200" />
                <div className="w-6 h-6 rounded-full bg-gray-200" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                    <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-full rounded bg-gray-200" />
                      <div className="h-3 w-3/4 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tasks & Calendar Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-5 w-40 rounded bg-gray-200 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-16 rounded-lg bg-slate-50" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Department Overview Skeleton */}
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 w-48 rounded bg-gray-200 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-5/6 rounded bg-gray-200" />
                  <div className="h-3 w-4/6 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Customers Table Skeleton
 * משמש בעמוד הלקוחות
 */
export function CustomersTableSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="טוען לקוחות">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="mb-2 h-3 w-2/3 rounded-full bg-gray-200" />
              <div className="h-6 w-1/2 rounded-full bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-4">
          <SkeletonTable rows={8} columns={7} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Order Details Skeleton
 * משמש בעמוד פרטי הזמנה
 */
export function OrderDetailsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="טוען פרטי הזמנה">
      {/* Header */}
      <div className="animate-pulse">
        <div className="mb-2 h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-200" />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Flow */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-4 h-5 w-1/4 rounded bg-gray-200" />
              <div className="h-24 rounded bg-gray-100" />
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-4 h-5 w-1/4 rounded bg-gray-200" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 rounded bg-gray-50 p-4">
                    <div className="h-16 w-16 rounded bg-gray-200" />
                    <div className="flex-1">
                      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                    <div className="h-6 w-20 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-4 h-5 w-1/3 rounded bg-gray-200" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-5/6 rounded bg-gray-200" />
                <div className="h-4 w-4/6 rounded bg-gray-200" />
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-4 h-5 w-1/3 rounded bg-gray-200" />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-1/3 rounded bg-gray-200" />
                    <div className="h-5 w-1/3 rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Map Widget Skeleton
 * משמש במפת ההזמנות
 */
export function MapWidgetSkeleton() {
  return (
    <Card className="animate-pulse" role="status" aria-label="טוען מפה">
      <CardContent className="p-0">
        <div className="h-96 rounded-lg bg-gray-100">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-200" />
              <div className="mx-auto h-4 w-32 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Reports Skeleton
 * משמש בדוחות
 */
export function ReportsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="טוען דוח">
      {/* Filters */}
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
                <div className="h-10 w-full rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-3 h-4 w-2/3 rounded bg-gray-200" />
              <div className="h-8 w-1/2 rounded bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Table */}
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <SkeletonTable rows={12} columns={6} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Form Skeleton
 * משמש בטפסים
 */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Card className="animate-pulse" role="status" aria-label="טוען טופס">
      <CardContent className="p-6">
        <div className="space-y-6">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i}>
              <div className="mb-2 h-3 w-1/4 rounded bg-gray-200" />
              <div className="h-10 w-full rounded bg-gray-200" />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4">
            <div className="h-10 w-24 rounded bg-gray-200" />
            <div className="h-10 w-24 rounded bg-gray-200" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Generic Card List Skeleton
 * משמש ברשימות כרטיסים
 */
export function CardListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="טוען רשימה">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="mb-3 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mb-2 h-6 w-1/2 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
