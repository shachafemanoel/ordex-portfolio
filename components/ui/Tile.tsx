import { cn } from '@/lib/utils';
import { ChevronLeft, LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface TileProps {
  title: string;
  value?: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  href?: string;
  className?: string;
  status?: 'default' | 'warning' | 'danger' | 'success' | 'info';
}

function TileBody({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
  status = 'default',
}: TileProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl p-6 bg-white shadow-sm border border-orange-100/40 hover:shadow-lg transition-all duration-300 group',
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div className={cn(
          "p-2.5 rounded-xl transition-colors",
          status === 'danger' ? "bg-red-50 text-red-600" :
          status === 'warning' ? "bg-orange-50 text-orange-600" :
          status === 'success' ? "bg-emerald-50 text-emerald-600" :
          status === 'info' ? "bg-orange-50/50 text-primary" :
          "bg-slate-50 text-text-secondary"
        )}>
          {Icon ? <Icon className="h-6 w-6" /> : <span className="material-symbols-outlined">analytics</span>}
        </div>
        
        {subtitle && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
            status === 'danger' ? "bg-red-50 text-red-600" :
            status === 'success' ? "bg-emerald-50 text-emerald-600" :
            "bg-slate-50 text-text-secondary/70"
          )}>
            {subtitle}
          </span>
        )}
      </div>
      
      <div className="mt-2 text-right">
        <p className="text-text-secondary/70 text-sm font-bold leading-normal mb-0.5">{title}</p>
        <p className="text-text-primary tracking-tight text-3xl font-extrabold leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

export function Tile(props: TileProps) {
  if (props.href) {
    return (
      <Link href={props.href} className="block">
        <TileBody {...props} />
      </Link>
    );
  }

  return <TileBody {...props} />;
}
