'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface QuickActionTab {
  label: string;
  href: string;
  badge?: number;
}

interface QuickNavHeaderProps {
  title: string;
  tabs: QuickActionTab[];
  className?: string;
}

export function QuickNavHeader({ title, tabs, className }: QuickNavHeaderProps) {
  const pathname = usePathname();

  return (
    <div className={cn('flex flex-col gap-4 mb-6', className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-fluid-page-title font-bold tracking-tight text-fg">
          {title}
        </h1>
      </div>

      {tabs.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2 scroll-smooth">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap select-none',
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                    : 'bg-surface text-fg-muted border border-subtle hover:bg-surface-muted hover:text-fg'
                )}
              >
                {tab.label}
                {tab.badge ? (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] rounded-full font-bold',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-muted text-fg-muted'
                    )}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
