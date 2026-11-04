interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'gray' | 'white';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const colorClasses = {
  blue: 'border-primary',
  gray: 'border-text-secondary',
  white: 'border-white',
};

export function LoadingSpinner({
  size = 'md',
  color = 'blue',
  message,
  fullScreen = false,
  className = '',
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={`animate-spin rounded-none border-4 border-t-[#0055ff] border-[#221610] dark:border-white dark:border-t-[#0055ff] ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label={message || 'טוען...'}
      suppressHydrationWarning
    />
  );

  const content = (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${fullScreen ? 'min-h-screen' : 'py-8'}`}
      suppressHydrationWarning
    >
      {spinner}
      {message && <p className="text-sm font-black uppercase tracking-tighter text-[#221610] dark:text-white text-center mt-2">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center"
        suppressHydrationWarning
      >
        {content}
      </div>
    );
  }

  return content;
}

// Inline loading spinner for buttons and small spaces
export function InlineSpinner({
  size = 'sm',
  color = 'blue',
  className = '',
}: Pick<LoadingSpinnerProps, 'size' | 'color' | 'className'>) {
  return (
    <div
      className={`animate-spin rounded-none border-2 border-t-[#0055ff] border-[#221610] dark:border-white dark:border-t-[#0055ff] ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="טוען..."
      suppressHydrationWarning
    />
  );
}

// Loading skeleton for content placeholders
export function LoadingSkeleton({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`bg-[#221610]/10 border border-[#221610]/20 rounded-none h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

// Loading card placeholder
export function LoadingCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse border-4 border-[#221610] rounded-none p-6 bg-white shadow-brutal-sm ${className}`}>
      <div className="space-y-4">
        <div className="bg-[#221610]/20 border-2 border-[#221610] rounded-none h-6 w-1/2"></div>
        <LoadingSkeleton lines={3} />
        <div className="flex gap-2 pt-2">
          <div className="bg-[#fbbf24] border-2 border-[#221610] rounded-none h-10 w-24"></div>
          <div className="bg-[#0055ff] border-2 border-[#221610] rounded-none h-10 w-16"></div>
        </div>
      </div>
    </div>
  );
}

// Loading table placeholder
export function LoadingTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="overflow-hidden border-4 border-[#221610] rounded-none bg-white shadow-brutal-sm">
        {/* Header */}
        <div className="bg-[#fbbf24] border-b-4 border-[#221610] p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }, (_, i) => (
              <div key={i} className="bg-[#221610] h-4 w-3/4"></div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="border-b-2 border-[#221610] last:border-0 p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <div
                  key={colIndex}
                  className={`bg-[#221610]/10 border border-[#221610]/20 rounded-none h-4 ${colIndex === 0 ? 'w-full' : 'w-2/3'}`}
                ></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
