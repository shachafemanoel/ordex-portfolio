import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const VARIANTS = {
  default: 'bg-white border-slate-200 text-slate-900',
  primary: 'bg-blue-50 border-blue-200 text-blue-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  danger: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-sky-50 border-sky-200 text-sky-900',
};

const ICON_COLORS = {
  default: 'text-slate-500 bg-slate-100',
  primary: 'text-blue-600 bg-blue-100',
  success: 'text-emerald-600 bg-emerald-100',
  warning: 'text-amber-600 bg-amber-100',
  danger: 'text-red-600 bg-red-100',
  info: 'text-sky-600 bg-sky-100',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  onClick,
  variant = 'default',
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all',
        VARIANTS[variant],
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium opacity-80">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          </div>
        </div>
        {Icon && (
          <div className={cn('p-2 rounded-lg', ICON_COLORS[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {(description || trend) && (
        <div className="mt-3 flex items-center text-xs">
          {trend && (
            <span
              className={cn(
                'font-medium mr-2',
                trend.direction === 'up' && 'text-emerald-600',
                trend.direction === 'down' && 'text-red-600',
                trend.direction === 'neutral' && 'text-slate-600'
              )}
            >
              {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '•'} {Math.abs(trend.value)}%
            </span>
          )}
          {description && <span className="text-slate-500 line-clamp-1">{description}</span>}
        </div>
      )}
    </div>
  );
}
