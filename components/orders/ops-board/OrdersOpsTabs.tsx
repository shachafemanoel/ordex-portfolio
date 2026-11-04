'use client';

import { cn } from '@/lib/utils';
import type { OpsTab } from '@/src/server/dto/ops.dto';
import { CalendarDays, Clock, LayoutList } from 'lucide-react';
import type { ElementType } from 'react';

const TABS: { id: OpsTab; labelHe: string; icon: ElementType }[] = [
  { id: 'active', labelHe: 'פעילות', icon: LayoutList },
  { id: 'new', labelHe: 'היום', icon: Clock },
  { id: 'future', labelHe: 'עתידיות', icon: CalendarDays },
];

interface OrdersOpsTabsProps {
  activeTab: OpsTab;
  onTabChange: (tab: OpsTab) => void;
}

export function OrdersOpsTabs({
  activeTab,
  onTabChange,
}: Readonly<OrdersOpsTabsProps>) {
  return (
    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tabItem) => {
        const Icon = tabItem.icon;

        return (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => onTabChange(tabItem.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-black whitespace-nowrap transition-all duration-200 active:scale-95',
              activeTab === tabItem.id
                ? 'border-primary-200 bg-primary-50 text-brand shadow-md'
                : 'border-surface-soft bg-surface-translucent text-ops-muted backdrop-blur-sm hover:bg-surface-translucent-strong'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {tabItem.labelHe}
          </button>
        );
      })}
    </div>
  );
}
