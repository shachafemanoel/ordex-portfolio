import { QuickActionTab, QuickNavHeader } from '@/components/common/QuickNavHeader';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ModuleLayoutProps {
  title: string;
  tabs?: QuickActionTab[];
  className?: string;
  children: ReactNode;
}

/**
 * ModuleLayout — page wrapper with title + tab navigation.
 * For pages with KPIs/feed sections, use `ModuleLayout` from `@/components/shared/ModuleLayout` instead.
 */
export function ModuleLayout({ title, tabs = [], className, children }: ModuleLayoutProps) {
  return (
    <div className={cn('w-full space-y-[var(--app-shell-gap)]', className)}>
      <div className="mx-auto max-w-[1600px]">
        <QuickNavHeader title={title} tabs={tabs} />
        <div className="animate-in fade-in-50 duration-300 space-y-[var(--app-shell-gap)]">
          {children}
        </div>
      </div>
    </div>
  );
}
