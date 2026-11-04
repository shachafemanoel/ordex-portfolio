'use client';

import { cn } from '@/lib/utils';

interface BadgeCountProps {
  count: number;
  className?: string;
}

/** Small count pill for tab badges and queue counters. */
export function BadgeCount({ count, className }: BadgeCountProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-warning-50)] px-1.5 text-xs font-medium text-warning',
        className
      )}
    >
      {count > 999 ? '999+' : count}
    </span>
  );
}
