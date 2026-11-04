'use client';

import { BadgeCount } from '@/src/ui/patterns/BadgeCount';
import type { OpsTab } from '@/src/server/dto/ops.dto';

interface OpsTabsProps {
  activeTab: OpsTab;
  onTabChange: (tab: OpsTab) => void;
  newCount?: number;
  futureCount?: number;
}

const TABS: { key: OpsTab; label: string }[] = [
  { key: 'new', label: 'New Orders' },
  { key: 'future', label: 'Future' },
];

/** Tab bar for Orders Ops: New Orders | Future */
export function OpsTabs({ activeTab, onTabChange, newCount, futureCount }: OpsTabsProps) {
  const counts: Record<OpsTab, number | undefined> = {
    active: undefined,
    new: newCount,
    future: futureCount,
  };

  return (
    <div className="flex border-b border-gray-200">
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        const count = counts[key];

        return (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={`
              flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${isActive
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {label}
            {count != null && count > 0 && <BadgeCount count={count} />}
          </button>
        );
      })}
    </div>
  );
}
