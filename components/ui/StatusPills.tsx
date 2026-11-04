import { cn } from '@/lib/utils';
import React from 'react';

interface StatusPillProps {
  label: string;
  variant?:
    | 'lane'
    | 'task'
    | 'priority'
    | 'default'
    | 'lane-blue'
    | 'lane-amber'
    | 'lane-indigo'
    | 'lane-green'
    | 'lane-red'
    | 'lane-slate';
  className?: string;
  pulse?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = 'default',
  className,
  pulse = false,
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variants = {
    // Legacy variants
    lane: 'bg-slate-100 text-slate-700 border border-slate-200',
    task: 'bg-blue-50 text-blue-700 border border-blue-100',
    priority: 'bg-amber-50 text-amber-700 border border-amber-100',
    default: 'bg-gray-100 text-gray-700 border border-gray-200',

    // Mobile UI lane variants (Phase 4)
    'lane-blue': 'bg-lane-blue-bg text-lane-blue-text border border-lane-blue-border',
    'lane-amber': 'bg-lane-amber-bg text-lane-amber-text border border-lane-amber-border',
    'lane-indigo': 'bg-blue-50 text-blue-700 border border-blue-200',
    'lane-green': 'bg-lane-green-bg text-lane-green-text border border-lane-green-border',
    'lane-red': 'bg-lane-red-bg text-lane-red-text border border-lane-red-border',
    'lane-slate': 'bg-lane-slate-bg text-lane-slate-text border border-lane-slate-border',
  };

  return (
    <span className={cn(baseStyles, variants[variant], pulse && 'animate-pulse', className)}>
      {label}
    </span>
  );
};

export const LanePill: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <StatusPill label={label} variant="lane" className={className} />
);

export const TaskPill: React.FC<{ label: string; className?: string }> = ({ label, className }) => (
  <StatusPill label={label} variant="task" className={className} />
);

export const PriorityPill: React.FC<{ label: string; className?: string; urgent?: boolean }> = ({
  label,
  className,
  urgent = false,
}) => (
  <StatusPill
    label={label}
    variant="priority"
    pulse={urgent}
    className={cn(urgent && 'bg-rose-50 text-rose-700 border-rose-100', className)}
  />
);
