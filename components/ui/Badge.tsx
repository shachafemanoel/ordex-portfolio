import { HTMLAttributes, forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'outline'
    | 'info'
    // OrdeX Mobile lane colors
    | 'lane-blue'
    | 'lane-amber'
    | 'lane-indigo'
    | 'lane-green'
    | 'lane-red'
    | 'lane-slate';
}

const Badge = memo(
  forwardRef<HTMLDivElement, BadgeProps>(({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default:
        'bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]',
      secondary:
        'tone-info',
      success:
        'tone-success',
      warning:
        'tone-warning',
      destructive:
        'border border-[var(--color-danger-500)]/20 bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
      info:
        'tone-info',
      outline:
        'border border-[var(--color-border-primary)] bg-transparent text-[var(--color-neutral-600)]',
      'lane-blue': 'bg-[var(--color-primary-500)] text-white',
      'lane-amber': 'bg-[var(--color-warning-500)] text-white',
      'lane-indigo': 'bg-[var(--color-primary-600)] text-white',
      'lane-green': 'bg-[var(--color-success-500)] text-white',
      'lane-red': 'bg-[var(--color-danger-500)] text-white',
      'lane-slate': 'bg-[var(--color-neutral-500)] text-white',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex min-h-[1.375rem] items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-center text-[11px] font-semibold capitalize leading-tight transition-all focus:outline-none focus:ring-0',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  })
);
Badge.displayName = 'Badge';

export { Badge };
