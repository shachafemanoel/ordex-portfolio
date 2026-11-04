/** Animated skeleton placeholder while ops queues are loading. */
export function OpsSkeletonLoader() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading queues">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {/* Header skeleton */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-6 rounded-full bg-gray-200 animate-pulse" />
          </div>

          {/* Top card skeleton */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
              </div>
              <div className="h-4 w-8 rounded bg-gray-200 animate-pulse" />
            </div>
            {/* Progress bar skeleton */}
            <div className="h-1.5 w-full rounded-full bg-gray-100 animate-pulse" />
            <div className="flex items-center justify-between mt-2">
              <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
              <div className="h-5 w-16 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>

          {/* Stack row skeleton */}
          <div className="px-4 py-2 border-t border-gray-100">
            <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
