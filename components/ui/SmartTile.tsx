import { cn } from '@/lib/utils';
import { ArrowLeft, LucideIcon } from 'lucide-react'; // Added ArrowLeft for RTL
import Link from 'next/link';

export interface SmartTileProps {
  title: string;
  count?: number;
  icon: LucideIcon;
  href: string;
  description?: string;
  variant?: 'default' | 'urgent' | 'success' | 'warning' | 'info';
  className?: string;
}

export function SmartTile({
  title,
  count,
  icon: Icon,
  href,
  description,
  variant = 'default',
  className,
}: SmartTileProps) {
  const variantStyles = {
    default: 'hover:border-primary/50 hover:shadow-primary/5 border-blue-100/40',
    urgent: 'bg-red-50/50 border-red-100 hover:border-red-300 hover:bg-red-50 text-red-700',
    success:
      'bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700',
    warning:
      'bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50 text-blue-700',
    info: 'bg-blue-50/20 border-blue-100 hover:border-blue-300 hover:bg-blue-50 text-primary',
  };

  const iconColor = {
    default: 'text-primary/80',
    urgent: 'text-red-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  };

  const countColor = {
    default: 'text-text-primary',
    urgent: 'text-red-700',
    success: 'text-emerald-700',
    warning: 'text-blue-700',
    info: 'text-primary',
  };

  return (
    <Link href={href} className="group block h-full">
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-2xl border bg-white p-6 transition-all duration-300',
          'hover:-translate-y-1 hover:shadow-xl',
          variant === 'default' ? 'border-border/60 shadow-sm' : '',
          variantStyles[variant],
          className
        )}
      >
        {/* Background Decorator */}
        <div
          className={cn(
            'absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-5 transition-transform duration-500 group-hover:scale-150',
            variant === 'default' ? 'bg-primary' : `bg-current`
          )}
        />

        <div className="relative flex flex-col justify-between h-full gap-4">
          <div className="flex items-start justify-between">
            <div
              className={cn(
                'rounded-xl p-3 ring-1 ring-inset transition-colors',
                variant === 'default'
                  ? 'bg-primary/5 ring-primary/10 group-hover:bg-primary/10'
                  : 'bg-white/50 ring-black/5',
                iconColor[variant]
              )}
            >
              <Icon className="h-6 w-6" />
            </div>

            {/* Action Arrow */}
            <ArrowLeft
              className={cn(
                'h-5 w-5 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0',
                variant === 'default' ? 'text-primary' : 'text-current'
              )}
            />
          </div>

          <div>
            {count !== undefined && (
              <div className={cn('text-3xl font-bold tracking-tight mb-1', countColor[variant])}>
                {count}
              </div>
            )}
            <h3
              className={cn('font-bold tracking-tight', variant === 'default' ? 'text-text-primary' : 'text-current')}
            >
              {title}
            </h3>
            {description && (
              <p
                className={cn(
                  'text-sm mt-1 line-clamp-2 font-medium',
                  variant === 'default' ? 'text-text-secondary/80' : 'text-current/80'
                )}
              >
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
