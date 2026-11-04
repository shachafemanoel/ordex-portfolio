'use client';

import { useState, useEffect } from 'react';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  timeout?: number; // in milliseconds
  onTimeout?: () => void;
  className?: string;
  'aria-live'?: 'polite' | 'assertive';
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  message = 'טוען...',
  timeout = 30000, // 30 seconds default timeout
  onTimeout,
  className = '',
  'aria-live': ariaLive = 'polite',
}) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (timeout && timeout > 0) {
      const timer = setTimeout(() => {
        setTimedOut(true);
        if (onTimeout) {
          onTimeout();
        }
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout, onTimeout]);

  if (timedOut) {
    return (
      <div className={`text-center text-red-600 ${className}`} aria-live={ariaLive}>
        <div className="mb-2">⚠️</div>
        <div>זמן הטעינה פג. אנא רענן את הדף.</div>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 text-sm bg-blue-600 text-on-dark rounded hover:bg-blue-700"
        >
          רענן דף
        </button>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`} aria-live={ariaLive}>
      <div
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
        role="status"
        aria-label="טוען"
      />
      {message && <span className="mt-2 text-sm text-gray-600">{message}</span>}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-gray-300 h-4 mb-2 rounded"></div>
    <div className="bg-gray-300 h-4 mb-2 rounded w-3/4"></div>
    <div className="bg-gray-300 h-4 rounded w-1/2"></div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div className="animate-pulse">
    <div className="grid grid-cols-1 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-300 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const PageLoading: React.FC<{ title?: string }> = ({ title = 'טוען דף...' }) => (
  <div className="min-h-[400px] flex items-center justify-center">
    <Loading size="lg" message={title} />
  </div>
);