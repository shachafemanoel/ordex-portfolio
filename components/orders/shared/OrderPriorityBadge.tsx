'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, MinusCircle } from 'lucide-react';

export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface OrderPriorityBadgeProps {
  priority: OrderPriority;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const priorityConfig = {
  LOW: {
    label: 'עדיפות נמוכה',
    shortLabel: 'נמוכה',
    icon: MinusCircle,
    colors: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      iconColor: 'text-slate-500',
    },
  },
  MEDIUM: {
    label: 'עדיפות בינונית',
    shortLabel: 'בינונית',
    icon: AlertCircle,
    colors: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      border: 'border-primary/30',
      iconColor: 'text-primary',
    },
  },
  HIGH: {
    label: 'עדיפות גבוהה',
    shortLabel: 'גבוהה',
    icon: AlertCircle,
    colors: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-300',
      iconColor: 'text-red-600',
    },
  },
} as const;

const sizeConfig = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'px-2.5 py-1 text-sm gap-1.5',
    icon: 'w-4 h-4',
  },
  lg: {
    container: 'px-3 py-1.5 text-base gap-2',
    icon: 'w-5 h-5',
  },
};

/**
 * OrderPriorityBadge
 *
 * Displays a visual badge for order priority (LOW, MEDIUM, HIGH)
 * with customizable size, icon, and label display options.
 *
 * @example
 * ```tsx
 * <OrderPriorityBadge priority="HIGH" />
 * <OrderPriorityBadge priority="MEDIUM" size="sm" showLabel={false} />
 * <OrderPriorityBadge priority="LOW" size="lg" showIcon={true} showLabel={true} />
 * ```
 */
export function OrderPriorityBadge({
  priority,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className,
}: OrderPriorityBadgeProps) {
  const config = priorityConfig[priority];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  if (!showIcon && !showLabel) {
    // If nothing to show, render a minimal dot indicator
    return (
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full',
          priority === 'HIGH' ? 'bg-red-500' : priority === 'MEDIUM' ? 'bg-primary' : 'bg-slate-400',
          className
        )}
        title={config.label}
        aria-label={config.label}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        config.colors.bg,
        config.colors.text,
        config.colors.border,
        sizeStyles.container,
        className
      )}
      title={config.label}
      aria-label={config.label}
    >
      {showIcon && <Icon className={cn(sizeStyles.icon, config.colors.iconColor)} />}
      {showLabel && <span>{config.shortLabel}</span>}
    </span>
  );
}

/**
 * OrderPriorityMark
 *
 * A compact circular mark/indicator for order priority.
 * Useful for tables, lists, or anywhere space is limited.
 *
 * @example
 * ```tsx
 * <OrderPriorityMark priority="HIGH" />
 * ```
 */
export function OrderPriorityMark({
  priority,
  size = 'md',
  className,
}: {
  priority: OrderPriority;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  const markSize = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full border',
        config.colors.bg,
        config.colors.border,
        markSize[size],
        className
      )}
      title={config.label}
      aria-label={config.label}
    >
      <Icon className={cn(iconSize[size], config.colors.iconColor)} />
    </div>
  );
}
