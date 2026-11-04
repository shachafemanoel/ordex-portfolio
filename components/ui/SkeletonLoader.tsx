/**
 * Skeleton Loader Component
 *
 * Provides loading placeholders with shimmer animation
 * for improved perceived performance.
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Base Skeleton component
 */
export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

/**
 * Skeleton for text lines
 */
export function SkeletonText({
  lines = 1,
  className = '',
  lastLineWidth = '60%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height="1rem"
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for a card
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`border rounded-lg p-6 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-4 space-x-reverse">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height="1.25rem" width="40%" />
            <Skeleton variant="text" height="1rem" width="60%" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <Skeleton variant="text" height="1rem" />
          <Skeleton variant="text" height="1rem" />
          <Skeleton variant="text" height="1rem" width="80%" />
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4">
          <Skeleton variant="rectangular" width={80} height={32} />
          <Skeleton variant="rectangular" width={100} height={32} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a table
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Table Header */}
      <div className="bg-gray-50 border-b">
        <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" height="1rem" width="80%" />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 p-4"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" height="1rem" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for a list
 */
export function SkeletonList({
  items = 5,
  className = '',
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 space-x-reverse">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" height="1rem" width="40%" />
            <Skeleton variant="text" height="0.875rem" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for stat cards (dashboard metrics)
 */
export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div className={`border rounded-lg p-6 ${className}`}>
      <div className="space-y-3">
        <Skeleton variant="text" height="0.875rem" width="50%" />
        <Skeleton variant="text" height="2rem" width="40%" />
        <div className="flex items-center space-x-2 space-x-reverse">
          <Skeleton variant="rectangular" width={16} height={16} />
          <Skeleton variant="text" height="0.75rem" width="60%" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a form
 */
export function SkeletonForm({
  fields = 4,
  className = '',
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton variant="text" height="0.875rem" width="30%" />
          <Skeleton variant="rectangular" height="2.5rem" />
        </div>
      ))}

      {/* Submit button */}
      <div className="flex justify-end space-x-3 space-x-reverse pt-4">
        <Skeleton variant="rectangular" width={100} height={40} />
        <Skeleton variant="rectangular" width={120} height={40} />
      </div>
    </div>
  );
}

/**
 * Full page skeleton with header and content
 */
export function SkeletonPage({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 ${className}`} dir="rtl">
      {/* Page Header */}
      <div className="space-y-4">
        <Skeleton variant="text" height="2rem" width="30%" />
        <div className="flex justify-between items-center">
          <Skeleton variant="text" height="1rem" width="40%" />
          <Skeleton variant="rectangular" width={120} height={40} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Main Content */}
      <SkeletonCard />
    </div>
  );
}
