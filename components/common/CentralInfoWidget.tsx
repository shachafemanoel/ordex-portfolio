import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface CentralInfoWidgetProps {
  title: string;
  value: string | number;
  description?: string;
  href?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode; // For custom content like charts
  disableLinkWrap?: boolean; // Disable wrapping in Link if children contain interactive elements
}

export function CentralInfoWidget({
  title,
  value,
  description,
  href,
  trend,
  icon,
  action,
  className,
  children,
  disableLinkWrap = false,
}: CentralInfoWidgetProps) {
  const content = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && <div className="p-2.5 bg-primary/10 text-primary rounded-lg">{icon}</div>}
          <div>
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-bold px-1.5 py-0.5 rounded-full',
                    trend.isPositive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}% {trend.label}
                </span>
              )}
            </div>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {href && (
            <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
          )}
        </div>
      </div>

      {/* Slot for Graphs/Extra specific data */}
      {children && <div className="mt-4 pt-4 border-t border-slate-100">{children}</div>}
    </>
  );

  const wrapperClass = cn(
    'bg-white rounded-xl border border-slate-200 shadow-sm p-6 group',
    href && !disableLinkWrap && 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-200',
    className
  );

  // If href is provided but link wrap is disabled, wrap only the header portion
  if (href && disableLinkWrap) {
    return (
      <div className={wrapperClass}>
        <Link href={href} className="block group-hover:opacity-90 transition-opacity">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {icon && <div className="p-2.5 bg-primary/10 text-primary rounded-lg">{icon}</div>}
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
                  {trend && (
                    <span
                      className={cn(
                        'text-xs font-bold px-1.5 py-0.5 rounded-full',
                        trend.isPositive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {trend.isPositive ? '+' : ''}
                      {trend.value}% {trend.label}
                    </span>
                  )}
                </div>
                {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </Link>
        {children && <div className="mt-4 pt-4 border-t border-slate-100">{children}</div>}
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(wrapperClass, 'block')}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
