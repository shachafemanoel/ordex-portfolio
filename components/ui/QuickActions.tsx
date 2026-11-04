import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface QuickActionItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface QuickActionsProps {
  actions: QuickActionItem[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        const isExternal = action.href.startsWith('http');

        return (
          <Link
            key={action.key}
            href={action.href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer noopener' : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
